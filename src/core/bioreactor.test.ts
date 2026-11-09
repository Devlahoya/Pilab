import { describe, expect, it } from "vitest";
import { BioreactorSim, ORGANISMS, PID, defaultConfig, oxygenSaturation, splitRange, transport } from "./bioreactor";

const yeast = ORGANISMS.find((o) => o.id === "yeast")!;
const ecoli = ORGANISMS.find((o) => o.id === "ecoli")!;

describe("Transporte en el tanque", () => {
  it("kLa típico de un biorreactor de 5 L (≈ 50–150 1/h a 800 rpm y 1 vvm)", () => {
    const cfg = defaultConfig(yeast);
    const tr = transport(cfg, 800, 1, 5, 30);
    expect(tr.kLa * 3600).toBeGreaterThan(50);
    expect(tr.kLa * 3600).toBeLessThan(150);
    expect(tr.Re).toBeGreaterThan(1e4); // turbulento
    expect(tr.PgP).toBeLessThan(1);
  });

  it("detecta inundación con poca agitación y mucho aire", () => {
    const cfg = defaultConfig(yeast);
    expect(transport(cfg, 250, 2, 5, 30).flooded).toBe(true);
    expect(transport(cfg, 900, 1, 5, 30).flooded).toBe(false);
  });

  it("solubilidad del O₂", () => {
    expect(oxygenSaturation(30)).toBeCloseTo(7.6, 0);
    expect(oxygenSaturation(37)).toBeCloseTo(6.7, 0);
  });
});

describe("PID", () => {
  it("anti-windup: no acumula integral mientras está saturado", () => {
    const pid = new PID();
    const s = { sp: 50, mode: "auto" as const, manual: 0, Kp: 1, Ti: 10, Td: 0 };
    for (let i = 0; i < 1000; i++) pid.update(s, 0, 1); // error enorme sostenido
    expect(pid.out).toBe(100);
    expect(pid.integral).toBeLessThanOrEqual(100);
    // cuando el error cambia de signo, la salida baja de inmediato
    pid.update(s, 80, 1);
    expect(pid.out).toBeLessThan(100);
  });

  it("transferencia sin salto de manual a automático", () => {
    const pid = new PID();
    pid.update({ sp: 30, mode: "manual", manual: 42, Kp: 2, Ti: 100, Td: 0 }, 30, 1);
    const u = pid.update({ sp: 30, mode: "auto", manual: 42, Kp: 2, Ti: 100, Td: 0 }, 30, 1);
    expect(u).toBeCloseTo(42, 6);
  });

  it("rango dividido: agitación primero, luego aire", () => {
    const cfg = defaultConfig(yeast);
    expect(splitRange(cfg, 0)).toEqual({ rpm: cfg.Nmin, vvm: cfg.vvmMin });
    expect(splitRange(cfg, 70).rpm).toBeCloseTo(cfg.Nmax);
    expect(splitRange(cfg, 100).vvm).toBeCloseTo(cfg.vvmMax);
  });
});

describe("Simulación", () => {
  it("lote sin alimentación: balance de masa X − X₀ ≈ Yxs·(S₀ − S)", () => {
    const cfg = defaultConfig(yeast);
    cfg.noise = false;
    const sim = new BioreactorSim(cfg);
    sim.runFor(10 * 3600);
    const { X, S } = sim.x;
    expect(X).toBeGreaterThan(cfg.X0 * 5);
    expect(X - cfg.X0).toBeCloseTo(yeast.Yxs * (cfg.S0 - S), 1);
  });

  it("el lazo de OD mantiene el setpoint mientras hay capacidad de transferencia", () => {
    const cfg = defaultConfig(yeast);
    cfg.noise = false;
    const sim = new BioreactorSim(cfg);
    sim.runFor(6 * 3600);
    const last = sim.history.slice(-60); // última media hora
    for (const h of last) expect(Math.abs(h.DOmeas - cfg.doLoop.sp)).toBeLessThan(3);
  });

  it("el lazo de temperatura mantiene ±0.5 °C", () => {
    const cfg = defaultConfig(yeast);
    cfg.noise = false;
    const sim = new BioreactorSim(cfg);
    sim.runFor(8 * 3600);
    const late = sim.history.filter((h) => h.t > 1);
    for (const h of late) expect(Math.abs(h.T - cfg.tLoop.sp)).toBeLessThan(0.5);
  });

  it("E. coli con mucho sustrato se limita por oxígeno y lo avisa", () => {
    const cfg = defaultConfig(ecoli);
    cfg.noise = false;
    const sim = new BioreactorSim(cfg);
    sim.runFor(12 * 3600);
    expect(sim.alarms.some((a) => a.code === "o2_limit")).toBe(true);
    expect(sim.history.every((h) => h.DO >= 0 && Number.isFinite(h.DO))).toBe(true);
  });

  it("las alarmas no parpadean con el ruido del sensor", () => {
    for (const org of ORGANISMS) {
      const sim = new BioreactorSim(defaultConfig(org));
      sim.runFor(24 * 3600);
      const counts = new Map<string, number>();
      for (const a of sim.alarms) counts.set(a.code, (counts.get(a.code) ?? 0) + 1);
      for (const [code, n] of counts) expect(n, `${org.id}:${code}`).toBeLessThanOrEqual(3);
    }
  });

  it("con la agitación mínima por omisión el impulsor no está inundado", () => {
    const cfg = defaultConfig(yeast);
    expect(transport(cfg, cfg.Nmin, cfg.vvmMin, cfg.V0, 30).flooded).toBe(false);
  });

  it("lote alimentado: el enclavamiento detiene la alimentación en el volumen máximo", () => {
    const cfg = defaultConfig(yeast);
    cfg.noise = false;
    cfg.feedMode = "constante";
    cfg.feedRate = 0.5;
    cfg.feedStart = 1;
    const sim = new BioreactorSim(cfg);
    sim.runFor(10 * 3600);
    expect(sim.x.V).toBeLessThanOrEqual(cfg.Vmax + 0.01);
    expect(sim.alarms.some((a) => a.code === "feed_interlock")).toBe(true);
  });

  it("falla de aire: el OD cae y se dispara la alarma", () => {
    const cfg = defaultConfig(yeast);
    cfg.noise = false;
    const sim = new BioreactorSim(cfg);
    sim.runFor(7 * 3600);
    sim.trigger("air_fail");
    sim.runFor(10 * 60);
    expect(sim.alarms.some((a) => a.code === "air_fail")).toBe(true);
    expect(sim.u.vvm).toBe(0);
  });
});
