/**
 * Simulador de un biorreactor aerobio de tanque agitado con instrumentación y
 * control.
 *
 * Modelo (balances de materia y energía, unidades SI internas en segundos):
 *   μ     = μmax · S/(Ks+S) · C/(Ko+C) · f(T)                    (Monod doble)
 *   dX/dt = μX − (F/V)·X                                          biomasa
 *   dS/dt = −μX/Yxs + (F/V)·(Sf − S)                              sustrato
 *   dC/dt = kLa·(C* − C) − OUR − (F/V)·C                          O₂ disuelto
 *   dV/dt = F                                                     volumen
 *   ρVcp·dT/dt = Q_rxn + P_g + UA(Tj − T) + UAamb(Tamb − T) + ρcp·F(Tf − T)
 *
 * La transferencia de oxígeno sale de los números adimensionales del tanque:
 *   P = Po·ρ·N³·D⁵ ;  Pg/P = f(Fl) ;  kLa = 0.026·(Pg/V)^0.4·v_s^0.5  (van't Riet)
 * y se revisa la inundación del impulsor con Fl_inund = 30·Fr·(D/Dt)^3.5.
 *
 * Control:
 *   - OD: PID con rango dividido (split range): 0–70 % de la salida sube la
 *     agitación de N_min a N_max; 70–100 % sube la aireación de vvm_min a vvm_max.
 *   - Temperatura: PID que manipula la temperatura del agua de la chaqueta.
 * Los sensores tienen retardo de primer orden y ruido.
 */

/* ───────────────────────── parámetros */

export interface Organism {
  id: string;
  name: string;
  description: string;
  muMax: number; // 1/h
  Ks: number; // g/L
  Yxs: number; // g X / g S
  Yxo: number; // g X / g O₂
  Ko: number; // mg/L
  mO: number; // g O₂ / g X / h (mantenimiento)
  Topt: number; // °C
  Twidth: number; // °C
  /** Velocidad de punta máxima recomendada (m/s), si es sensible al corte. */
  tipLimit?: number;
}

export const ORGANISMS: Organism[] = [
  {
    id: "ecoli", name: "E. coli (bacteria)",
    description: "Crece rápido y consume mucho oxígeno: pone a prueba la transferencia de O₂.",
    muMax: 0.7, Ks: 0.05, Yxs: 0.5, Yxo: 1.0, Ko: 0.2, mO: 0.01, Topt: 37, Twidth: 8,
  },
  {
    id: "yeast", name: "S. cerevisiae (levadura)",
    description: "Crecimiento moderado a 30 °C. Buen caso para aprender a sintonizar los lazos.",
    muMax: 0.35, Ks: 0.1, Yxs: 0.5, Yxo: 1.2, Ko: 0.1, mO: 0.005, Topt: 30, Twidth: 7,
  },
  {
    id: "fungus", name: "Aspergillus (hongo filamentoso)",
    description: "Lento y sensible al esfuerzo de corte: la velocidad de punta del impulsor está limitada.",
    muMax: 0.15, Ks: 0.2, Yxs: 0.45, Yxo: 1.1, Ko: 0.3, mO: 0.008, Topt: 30, Twidth: 7, tipLimit: 2.5,
  },
];

export interface PIDSettings {
  sp: number;
  mode: "auto" | "manual";
  /** Salida manual (0–100 %). */
  manual: number;
  Kp: number;
  /** Tiempo integral (s); 0 = sin acción integral. */
  Ti: number;
  /** Tiempo derivativo (s). */
  Td: number;
}

export interface ReactorConfig {
  organism: Organism;
  V0: number; // L
  Vmax: number; // L
  X0: number; // g/L
  S0: number; // g/L
  Sf: number; // g/L en la alimentación
  feedMode: "lote" | "constante";
  feedRate: number; // L/h
  feedStart: number; // h
  Nmin: number; // rpm
  Nmax: number; // rpm
  vvmMin: number;
  vvmMax: number;
  Po: number;
  /** Relación D/Dt del impulsor. */
  dRatio: number;
  UA: number; // W/K chaqueta
  UAamb: number; // W/K pérdidas
  Tamb: number; // °C
  Tfeed: number; // °C
  T0: number; // °C inicial
  doTau: number; // s, retardo del electrodo de OD
  tTau: number; // s, retardo del termómetro
  noise: boolean;
  doLoop: PIDSettings;
  tLoop: PIDSettings;
}

export function defaultConfig(org: Organism = ORGANISMS[1]): ReactorConfig {
  return {
    organism: org,
    V0: 5, Vmax: 7, X0: 0.1, S0: 20, Sf: 400,
    feedMode: "lote", feedRate: 0.05, feedStart: 8,
    Nmin: 300, Nmax: 1000, vvmMin: 0.5, vvmMax: 2,
    Po: 5, dRatio: 1 / 3,
    UA: 12, UAamb: 1, Tamb: 22, Tfeed: 25, T0: org.Topt,
    doTau: 20, tTau: 10, noise: true,
    doLoop: suggestedDOTuning(),
    tLoop: suggestedTTuning(org.Topt),
  };
}

export const suggestedDOTuning = (sp = 30): PIDSettings => ({ sp, mode: "auto", manual: 30, Kp: 1.5, Ti: 150, Td: 0 });
export const suggestedTTuning = (sp = 37): PIDSettings => ({ sp, mode: "auto", manual: 50, Kp: 12, Ti: 600, Td: 0 });

/* ───────────────────────── transporte (números adimensionales) */

const RHO = 1000, CP = 4180, G = 9.81, MU = 1e-3;

export interface Transport {
  Dt: number; D: number; H: number;
  N: number; // rps
  P: number; Pg: number; PgP: number; PV: number; // W, W, -, W/m³
  Re: number; Fr: number; Fl: number; FlFlood: number; flooded: boolean;
  vs: number; Qg: number; // m/s, m³/s
  kLa: number; // 1/s
  tip: number; // m/s
  Cstar: number; // mg/L
}

/** Solubilidad del O₂ en agua en equilibrio con aire a 1 atm (mg/L). */
export const oxygenSaturation = (T: number) => 14.62 - 0.3898 * T + 0.006969 * T * T - 0.00005897 * T * T * T;

/** Geometría fija del tanque: se diseña para V0 con H = Dt. */
export function tankGeometry(cfg: ReactorConfig) {
  const Dt = Math.cbrt((4 * cfg.V0 / 1000) / Math.PI);
  return { Dt, D: cfg.dRatio * Dt };
}

export function transport(cfg: ReactorConfig, rpm: number, vvm: number, V: number, T: number): Transport {
  const { Dt, D } = tankGeometry(cfg);
  const A = (Math.PI / 4) * Dt * Dt;
  const H = V / 1000 / A;
  const N = Math.max(rpm, 0) / 60;
  const P = cfg.Po * RHO * N ** 3 * D ** 5;
  const Qg = (Math.max(vvm, 0) * V) / 1000 / 60;
  const Re = (RHO * N * D * D) / MU;
  const Fr = (N * N * D) / G;
  const Fl = N > 0 ? Qg / (N * D ** 3) : 0;
  const PgP = Math.min(1, Math.max(0.25, Fl < 0.035 ? 1 - 12.6 * Fl : 0.62 - 1.85 * Fl));
  const Pg = P * PgP;
  const PV = Pg / (V / 1000);
  const vs = Qg / A;
  const FlFlood = 30 * Fr * cfg.dRatio ** 3.5;
  const kLa = 0.026 * Math.pow(Math.max(PV, 0), 0.4) * Math.sqrt(vs) + 5e-4; // + aireación superficial
  return {
    Dt, D, H, N, P, Pg, PgP, PV, Re, Fr, Fl, FlFlood, flooded: Fl > FlFlood && N > 0,
    vs, Qg, kLa, tip: Math.PI * N * D, Cstar: oxygenSaturation(T),
  };
}

/* ───────────────────────── modelo dinámico */

export interface ReactorState {
  X: number; // g/L
  S: number; // g/L
  C: number; // mg/L
  V: number; // L
  T: number; // °C
}

export interface Actuators {
  rpm: number;
  vvm: number;
  Tj: number; // °C
  F: number; // L/h
}

export function growthRate(org: Organism, S: number, C: number, T: number): number {
  const fT = Math.exp(-(((T - org.Topt) / org.Twidth) ** 2));
  return org.muMax * (S / (org.Ks + S)) * (C / (org.Ko + C)) * fT;
}

function derivatives(cfg: ReactorConfig, x: ReactorState, u: Actuators): ReactorState {
  const org = cfg.organism;
  const S = Math.max(x.S, 0), C = Math.max(x.C, 0);
  const tr = transport(cfg, u.rpm, u.vvm, x.V, x.T);
  const mu = growthRate(org, S, C, x.T) / 3600; // 1/s
  const D = u.F / 3600 / x.V; // 1/s
  const OUR = (mu * x.X) / org.Yxo + (org.mO / 3600) * x.X * (C / (org.Ko + C)); // g O₂/L/s
  const Qrxn = 14.4e3 * OUR * x.V; // W (≈ 460 kJ/mol O₂)
  const heat =
    Qrxn + tr.Pg + cfg.UA * (u.Tj - x.T) + cfg.UAamb * (cfg.Tamb - x.T) + RHO * CP * (u.F / 3.6e6) * (cfg.Tfeed - x.T);
  return {
    X: mu * x.X - D * x.X,
    S: -(mu * x.X) / org.Yxs + D * (cfg.Sf - S),
    C: tr.kLa * (tr.Cstar - C) - OUR * 1000 - D * C,
    V: u.F / 3600,
    T: heat / (RHO * CP * (x.V / 1000)),
  };
}

const add = (a: ReactorState, b: ReactorState, k: number): ReactorState => ({
  // El O₂ se mantiene fijo en las etapas de RK4 (se integra aparte, semi-implícito)
  X: a.X + k * b.X, S: Math.max(a.S + k * b.S, 0), C: a.C, V: a.V + k * b.V, T: a.T + k * b.T,
});

/**
 * Un paso de integración.
 *
 * X, S, V y T se integran con Runge–Kutta de 4.º orden. El oxígeno disuelto
 * es «rígido» cuando el cultivo está limitado por O₂ (su escala de tiempo,
 * Ko/OUR, es de décimas de segundo), así que se actualiza con un esquema
 * semi-implícito que es estable y nunca da concentraciones negativas:
 *   C⁺ = (C + Δt·kLa·C*) / (1 + Δt·(kLa + q/(Ko + C) + F/V))
 */
export function integrate(cfg: ReactorConfig, x: ReactorState, u: Actuators, dt: number): ReactorState {
  const k1 = derivatives(cfg, x, u);
  const k2 = derivatives(cfg, add(x, k1, dt / 2), u);
  const k3 = derivatives(cfg, add(x, k2, dt / 2), u);
  const k4 = derivatives(cfg, add(x, k3, dt), u);
  const n = {
    X: x.X + (dt / 6) * (k1.X + 2 * k2.X + 2 * k3.X + k4.X),
    S: x.S + (dt / 6) * (k1.S + 2 * k2.S + 2 * k3.S + k4.S),
    V: x.V + (dt / 6) * (k1.V + 2 * k2.V + 2 * k3.V + k4.V),
    T: x.T + (dt / 6) * (k1.T + 2 * k2.T + 2 * k3.T + k4.T),
  };
  // Oxígeno: semi-implícito
  const org = cfg.organism;
  const tr = transport(cfg, u.rpm, u.vvm, x.V, x.T);
  const S = Math.max(x.S, 0);
  const fT = Math.exp(-(((x.T - org.Topt) / org.Twidth) ** 2));
  const muNoO2 = (org.muMax * (S / (org.Ks + S)) * fT) / 3600; // 1/s
  const q = ((muNoO2 * x.X) / org.Yxo + (org.mO / 3600) * x.X) * 1000; // mg/L/s
  const D = u.F / 3600 / x.V;
  const C = (x.C + dt * tr.kLa * tr.Cstar) / (1 + dt * (tr.kLa + q / (org.Ko + Math.max(x.C, 0)) + D));
  return { ...n, C: Math.max(C, 0), X: Math.max(n.X, 0), S: Math.max(n.S, 0) };
}

/* ───────────────────────── PID */

/**
 * PID discreto de forma estándar (ISA):
 *   u = bias + Kp·[ e + (1/Ti)∫e dt − Td·d(PV)/dt ]
 * con derivada sobre la medición (evita «patadas» al cambiar el setpoint),
 * anti-windup por integración condicional y transferencia sin salto
 * (bumpless) de manual a automático.
 */
export class PID {
  integral = 0;
  private prevPv: number | null = null;
  private dFilt = 0;
  out = 0;
  P = 0; I = 0; D = 0;

  constructor(public uMin = 0, public uMax = 100) {}

  reset(u = 0) {
    this.integral = u;
    this.prevPv = null;
    this.dFilt = 0;
    this.out = u;
  }

  update(s: PIDSettings, pv: number, dt: number): number {
    if (s.mode === "manual") {
      this.out = Math.min(this.uMax, Math.max(this.uMin, s.manual));
      this.integral = this.out; // seguimiento para transferencia sin salto
      this.prevPv = pv;
      this.P = 0; this.I = this.out; this.D = 0;
      return this.out;
    }
    const e = s.sp - pv;
    const dPv = this.prevPv === null ? 0 : (pv - this.prevPv) / dt;
    this.prevPv = pv;
    const alpha = s.Td > 0 ? dt / (dt + s.Td / 8) : 1;
    this.dFilt += alpha * (dPv - this.dFilt);
    this.P = s.Kp * e;
    this.D = -s.Kp * s.Td * this.dFilt;
    const inc = s.Ti > 0 ? (s.Kp / s.Ti) * e * dt : 0;
    const trial = this.P + this.integral + inc + this.D;
    // Integración condicional: no integrar si empuja más allá de la saturación
    if (!((trial > this.uMax && inc > 0) || (trial < this.uMin && inc < 0))) this.integral += inc;
    this.integral = Math.min(this.uMax, Math.max(this.uMin, this.integral));
    this.I = this.integral;
    this.out = Math.min(this.uMax, Math.max(this.uMin, this.P + this.integral + this.D));
    return this.out;
  }
}

/** Rango dividido del lazo de OD: salida (%) → agitación y aireación. */
export function splitRange(cfg: ReactorConfig, u: number) {
  if (u <= 70) return { rpm: cfg.Nmin + ((cfg.Nmax - cfg.Nmin) * u) / 70, vvm: cfg.vvmMin };
  return { rpm: cfg.Nmax, vvm: cfg.vvmMin + ((cfg.vvmMax - cfg.vvmMin) * (u - 70)) / 30 };
}

/** Salida del lazo de temperatura (%) → temperatura del agua de la chaqueta. */
export const jacketTemp = (u: number) => 5 + (55 * u) / 100;

/* ───────────────────────── alarmas */

export type AlarmLevel = "crítica" | "alta" | "aviso" | "info";

export interface Alarm {
  id: number;
  code: string;
  level: AlarmLevel;
  message: string;
  tOn: number; // s
  tOff?: number;
  acked: boolean;
}

/* ───────────────────────── perturbaciones */

export type DisturbanceKind = "air_fail" | "cooling_fail" | "substrate_pulse" | "do_drift";

export const DISTURBANCES: { kind: DisturbanceKind; label: string; description: string }[] = [
  { kind: "air_fail", label: "Falla de aire (15 min)", description: "El compresor se detiene: la aireación cae a cero durante 15 minutos." },
  { kind: "cooling_fail", label: "Falla de enfriamiento (30 min)", description: "Se pierde el agua fría: la chaqueta no puede bajar de 35 °C durante 30 minutos." },
  { kind: "substrate_pulse", label: "Pulso de sustrato (+5 g/L)", description: "Se agrega sustrato de golpe: aumenta la demanda de oxígeno." },
  { kind: "do_drift", label: "Electrodo de OD descalibrado (+10 %)", description: "El sensor marca 10 puntos de más: el control «cree» que hay más oxígeno del real." },
];

/* ───────────────────────── simulador */

export interface HistoryPoint {
  t: number; // h
  X: number; S: number; V: number;
  DO: number; DOmeas: number; DOsp: number; // % saturación
  T: number; Tmeas: number; Tsp: number; Tj: number;
  rpm: number; vvm: number; F: number;
  kLa: number; // 1/h
  OTR: number; OUR: number; // g/L/h
  doOut: number; tOut: number; // % salida de controladores
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class BioreactorSim {
  t = 0; // s
  x: ReactorState;
  u: Actuators;
  doPid = new PID();
  tPid = new PID();
  doMeas: number; // %
  tMeas: number; // °C
  history: HistoryPoint[] = [];
  alarms: Alarm[] = [];
  private alarmSeq = 0;
  private active = new Map<string, Alarm>();
  private airFailUntil = -1;
  private coolFailUntil = -1;
  doOffset = 0;
  private satSince = -1;
  private rand: () => number;
  private lastRecord = -Infinity;
  readonly dt = 5; // s
  readonly recordEvery = 30; // s

  constructor(public cfg: ReactorConfig) {
    const T = cfg.T0;
    this.x = { X: cfg.X0, S: cfg.S0, C: oxygenSaturation(T), V: cfg.V0, T };
    this.doMeas = 100;
    this.tMeas = T;
    this.doPid.reset(cfg.doLoop.mode === "manual" ? cfg.doLoop.manual : 20);
    this.tPid.reset(cfg.tLoop.mode === "manual" ? cfg.tLoop.manual : 50);
    const sr = splitRange(cfg, this.doPid.out);
    this.u = { rpm: sr.rpm, vvm: sr.vvm, Tj: jacketTemp(this.tPid.out), F: 0 };
    this.rand = rng(12345);
    this.record();
  }

  get hours() {
    return this.t / 3600;
  }

  /** Transporte en el estado actual. */
  transport(): Transport {
    return transport(this.cfg, this.u.rpm, this.u.vvm, this.x.V, this.x.T);
  }

  OUR(): number {
    const org = this.cfg.organism;
    const mu = growthRate(org, this.x.S, this.x.C, this.x.T);
    return (mu * this.x.X) / org.Yxo + org.mO * this.x.X * (this.x.C / (org.Ko + this.x.C)); // g/L/h
  }

  trigger(kind: DisturbanceKind) {
    if (kind === "air_fail") this.airFailUntil = this.t + 15 * 60;
    if (kind === "cooling_fail") this.coolFailUntil = this.t + 30 * 60;
    if (kind === "substrate_pulse") this.x = { ...this.x, S: this.x.S + 5 };
    if (kind === "do_drift") this.doOffset = this.doOffset ? 0 : 10;
  }

  private noise(sd: number) {
    if (!this.cfg.noise) return 0;
    // Box–Muller
    const u1 = Math.max(this.rand(), 1e-12), u2 = this.rand();
    return sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  step() {
    const { cfg, dt } = this;
    const tr0 = this.transport();

    // 1) Sensores: retardo de primer orden + ruido
    const doTrue = (100 * this.x.C) / tr0.Cstar;
    this.doMeas += (dt / (cfg.doTau + dt)) * (doTrue - this.doMeas);
    this.tMeas += (dt / (cfg.tTau + dt)) * (this.x.T - this.tMeas);
    const doRead = Math.max(0, this.doMeas + this.doOffset + this.noise(0.4));
    const tRead = this.tMeas + this.noise(0.03);

    // 2) Controladores
    const uDo = this.doPid.update(cfg.doLoop, doRead, dt);
    const uT = this.tPid.update(cfg.tLoop, tRead, dt);
    const sr = splitRange(cfg, uDo);
    let rpm = sr.rpm;
    if (cfg.organism.tipLimit) {
      const { D } = tankGeometry(cfg);
      rpm = Math.min(rpm, (60 * cfg.organism.tipLimit) / (Math.PI * D)); // enclavamiento por corte
    }
    let vvm = sr.vvm;
    let Tj = jacketTemp(uT);
    if (this.t < this.airFailUntil) vvm = 0;
    if (this.t < this.coolFailUntil) Tj = Math.max(Tj, 35);

    // 3) Alimentación con enclavamiento por nivel alto
    let F = 0;
    if (cfg.feedMode === "constante" && this.hours >= cfg.feedStart && this.x.V < cfg.Vmax) F = cfg.feedRate;
    this.u = { rpm, vvm, Tj, F };

    // 4) Integración
    this.x = integrate(cfg, this.x, this.u, dt);
    this.t += dt;

    // 5) Alarmas
    this.checkAlarms(doRead, uDo);

    if (this.t - this.lastRecord >= this.recordEvery - 1e-9) this.record(doRead, tRead);
  }

  runFor(seconds: number) {
    const end = this.t + seconds;
    while (this.t < end - 1e-9) this.step();
  }

  private pendingSince = new Map<string, number>();

  /**
   * Activa o normaliza una alarma con retardo (30 s para activar, 90 s para
   * normalizar), como en un sistema de control real: evita que el ruido del
   * sensor haga «parpadear» la alarma cerca del umbral.
   */
  private setAlarm(code: string, on: boolean, level: AlarmLevel, message: string) {
    const cur = this.active.get(code);
    if (on === !!cur) {
      this.pendingSince.delete(code);
      return;
    }
    const since = this.pendingSince.get(code) ?? this.t;
    this.pendingSince.set(code, since);
    if (this.t - since < (on ? 30 : 90)) return;
    this.pendingSince.delete(code);
    if (on && !cur) {
      const a: Alarm = { id: ++this.alarmSeq, code, level, message, tOn: this.t, acked: false };
      this.active.set(code, a);
      this.alarms.unshift(a);
      if (this.alarms.length > 200) this.alarms.pop();
    } else if (!on && cur) {
      cur.tOff = this.t;
      this.active.delete(code);
    }
  }

  activeAlarms(): Alarm[] {
    return [...this.active.values()];
  }

  acknowledge(id?: number) {
    for (const a of this.alarms) if (id === undefined || a.id === id) a.acked = true;
  }

  private checkAlarms(doRead: number, uDo: number) {
    const { cfg, x } = this;
    const tr = this.transport();
    const org = cfg.organism;
    // Saturación del lazo de OD sostenida
    if (uDo >= 99.5 && cfg.doLoop.mode === "auto") {
      if (this.satSince < 0) this.satSince = this.t;
    } else this.satSince = -1;

    this.setAlarm("do_low", doRead < 10, "crítica", "Oxígeno disuelto bajo (< 10 %): riesgo de metabolismo anaerobio.");
    this.setAlarm(
      "o2_limit",
      this.satSince >= 0 && this.t - this.satSince > 120 && doRead < cfg.doLoop.sp - 5,
      "alta",
      "Agitación y aireación al máximo y el OD no alcanza el setpoint: el proceso está limitado por transferencia de oxígeno.",
    );
    this.setAlarm("t_dev", Math.abs(x.T - cfg.tLoop.sp) > 1, "aviso", "Temperatura fuera de ±1 °C del setpoint.");
    this.setAlarm("t_high", x.T > org.Topt + 6, "crítica", `Temperatura muy alta (> ${org.Topt + 6} °C): riesgo de dañar el cultivo.`);
    this.setAlarm("flood", tr.flooded, "aviso", "Impulsor inundado (Fl > Fl de inundación): el gas pasa sin dispersarse. Sube la agitación o baja la aireación.");
    this.setAlarm("level_high", x.V > 0.95 * cfg.Vmax, "aviso", "Nivel alto: el volumen supera el 95 % de la capacidad.");
    this.setAlarm(
      "feed_interlock",
      cfg.feedMode === "constante" && this.hours >= cfg.feedStart && x.V >= cfg.Vmax,
      "info",
      "Enclavamiento: la alimentación se detuvo por nivel máximo.",
    );
    this.setAlarm("s_out", x.S < 0.05, "info", "Sustrato agotado: el crecimiento se detiene.");
    this.setAlarm("air_fail", this.t < this.airFailUntil, "alta", "Falla del suministro de aire.");
    this.setAlarm("cool_fail", this.t < this.coolFailUntil, "alta", "Falla del agua de enfriamiento.");
    if (org.tipLimit) {
      const { D } = tankGeometry(cfg);
      const wanted = splitRange(cfg, uDo).rpm;
      this.setAlarm(
        "shear",
        Math.PI * (wanted / 60) * D > org.tipLimit,
        "aviso",
        `El control pide más agitación de la permitida: velocidad de punta limitada a ${org.tipLimit} m/s para no dañar el micelio.`,
      );
    }
  }

  private record(doRead?: number, tRead?: number) {
    const tr = this.transport();
    const OTR = (tr.kLa * (tr.Cstar - this.x.C) * 3600) / 1000;
    this.history.push({
      t: this.hours,
      X: this.x.X, S: this.x.S, V: this.x.V,
      DO: (100 * this.x.C) / tr.Cstar,
      DOmeas: doRead ?? this.doMeas,
      DOsp: this.cfg.doLoop.mode === "auto" ? this.cfg.doLoop.sp : NaN,
      T: this.x.T, Tmeas: tRead ?? this.tMeas,
      Tsp: this.cfg.tLoop.mode === "auto" ? this.cfg.tLoop.sp : NaN,
      Tj: this.u.Tj,
      rpm: this.u.rpm, vvm: this.u.vvm, F: this.u.F,
      kLa: tr.kLa * 3600,
      OTR, OUR: this.OUR(),
      doOut: this.doPid.out, tOut: this.tPid.out,
    });
    this.lastRecord = this.t;
  }
}
