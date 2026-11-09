import { useEffect, useMemo, useRef, useState } from "react";
import {
  BioreactorSim,
  DISTURBANCES,
  ORGANISMS,
  ReactorConfig,
  defaultConfig,
  growthRate,
  jacketTemp,
  splitRange,
  suggestedDOTuning,
  suggestedTTuning,
  tankGeometry,
} from "../../core";
import { CloudSaveButton } from "../cloud/CloudSaveButton";
import { formatValue } from "../format";
import { Sym } from "../Math";
import { AlarmPanel } from "./AlarmPanel";
import { LoopPanel } from "./LoopPanel";
import { Synoptic } from "./Synoptic";
import { TimeChart } from "./TimeChart";

const SPEEDS = [
  { v: 60, label: "1 min/s" },
  { v: 600, label: "10 min/s" },
  { v: 3600, label: "1 h/s" },
];

/** Campos que sólo se aplican al reiniciar (cambian el estado inicial o la geometría). */
const RESTART_FIELDS: (keyof ReactorConfig)[] = ["organism", "V0", "X0", "S0", "T0"];

/** Simulación abierta desde la nube o desde un enlace compartido. */
export interface SimIncoming {
  cfg: ReactorConfig;
  duration?: number;
  title: string;
  cloudId?: string;
  savedPayload?: string;
  nonce: number;
}

interface Props {
  incoming?: SimIncoming | null;
  notify: (msg: string) => void;
  onNeedLogin: () => void;
  onSaved: () => void;
}

export function SimulatorView({ incoming, notify, onNeedLogin, onSaved }: Props) {
  const [cfg, setCfg] = useState<ReactorConfig>(() => defaultConfig());
  const [appliedCfg, setAppliedCfg] = useState(cfg);
  const simRef = useRef<BioreactorSim>(new BioreactorSim(cfg));
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(600);
  const [duration, setDuration] = useState(24);
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [title, setTitle] = useState("Simulación de biorreactor");
  const [cloudId, setCloudId] = useState<string | undefined>();
  const [savedPayload, setSavedPayload] = useState<string | undefined>();
  const sim = simRef.current;
  const rerender = () => setTick((t) => t + 1);

  // Abrir una simulación guardada
  useEffect(() => {
    if (!incoming) return;
    const c: ReactorConfig = { ...defaultConfig(incoming.cfg.organism), ...incoming.cfg };
    setCfg(c);
    if (incoming.duration) setDuration(incoming.duration);
    setTitle(incoming.title);
    setCloudId(incoming.cloudId);
    setSavedPayload(incoming.savedPayload);
    setRunning(false);
    simRef.current = new BioreactorSim(c);
    setAppliedCfg(c);
    setHoverT(null);
    setTick((t) => t + 1);
  }, [incoming]);

  const payload = JSON.stringify({ cfg, duration });

  // Bucle de simulación: 10 actualizaciones por segundo
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const s = simRef.current;
      const remaining = duration * 3600 - s.t;
      if (remaining <= 0) {
        setRunning(false);
        return;
      }
      s.runFor(Math.min(speed * 0.1, remaining));
      rerender();
    }, 100);
    return () => window.clearInterval(id);
  }, [running, speed, duration]);

  const needsRestart = RESTART_FIELDS.some((k) => cfg[k] !== appliedCfg[k]);

  /** Cambios en vivo (lazos, alimentación, límites): se aplican de inmediato. */
  const updateLive = (patch: Partial<ReactorConfig>) => {
    const next = { ...cfg, ...patch };
    setCfg(next);
    const live = { ...next };
    for (const k of RESTART_FIELDS) (live as Record<string, unknown>)[k] = appliedCfg[k];
    simRef.current.cfg = live;
    rerender();
  };

  const restart = (c: ReactorConfig = cfg) => {
    setRunning(false);
    simRef.current = new BioreactorSim(c);
    setAppliedCfg(c);
    setHoverT(null);
    rerender();
  };

  const runToEnd = () => {
    setRunning(false);
    const remaining = duration * 3600 - simRef.current.t;
    if (remaining > 0) simRef.current.runFor(remaining);
    rerender();
  };

  const tr = sim.transport();
  const activeCodes = useMemo(() => new Set(sim.activeAlarms().map((a) => a.code)), [sim, sim.t, sim.alarms.length]);
  const doRead = Math.max(0, sim.doMeas + sim.doOffset);
  const mu = growthRate(sim.cfg.organism, sim.x.S, sim.x.C, sim.x.T);
  const OUR = sim.OUR();
  const OTRmax = (tr.kLa * tr.Cstar * 3600) / 1000;
  const { D } = tankGeometry(sim.cfg);
  const sr = splitRange(sim.cfg, sim.doPid.out);
  const hist = sim.history;
  const tMax = Math.max(duration, Math.ceil(sim.hours));

  const downloadCsv = () => {
    const cols = ["t", "X", "S", "V", "DO", "DOmeas", "DOsp", "T", "Tmeas", "Tsp", "Tj", "rpm", "vvm", "F", "kLa", "OTR", "OUR", "doOut", "tOut"] as const;
    const head = "t (h),X (g/L),S (g/L),V (L),OD real (%),OD medido (%),OD SP (%),T (°C),T medida (°C),T SP (°C),T chaqueta (°C),N (rpm),aire (vvm),F (L/h),kLa (1/h),OTR (g/L/h),OUR (g/L/h),salida AIC (%),salida TIC (%)";
    const lines = hist.map((h) => cols.map((c) => (Number.isFinite(h[c]) ? +h[c].toPrecision(6) : "")).join(","));
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "simulacion-biorreactor.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="simview">
      <header className="sim-hero">
        <img src="/img/mascota2.jpg" alt="" className="hero-mascot" width={120} height={180} />
        <div>
          <h1>Simulador de biorreactor</h1>
          <p className="muted">
            Instrumentación y control de un tanque agitado de {formatValue(appliedCfg.V0, 3)} L: lazos PID de oxígeno disuelto y
            temperatura, alarmas y perturbaciones. La transferencia de oxígeno se calcula con los números adimensionales del tanque.
          </p>
          <div className="sim-save">
            <input className="input sim-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Nombre de la simulación" maxLength={200} />
            <CloudSaveButton
              kind="simulacion"
              title={title}
              payload={payload}
              cloudId={cloudId}
              savedPayload={savedPayload}
              onSaved={(doc, pl) => {
                setCloudId(doc.id);
                setSavedPayload(pl);
                onSaved();
              }}
              onNeedLogin={onNeedLogin}
              notify={notify}
            />
          </div>
        </div>
      </header>

      <details className="whatif-box sim-help">
        <summary>¿Qué simula y cómo lo uso?</summary>
        <ul>
          <li>
            <strong>Proceso:</strong> crecimiento microbiano (Monod con limitación por sustrato y oxígeno), balances de biomasa X,
            sustrato S, oxígeno disuelto, volumen y temperatura.
          </li>
          <li>
            <strong>Oxígeno:</strong> el lazo AIC-101 mide el OD y manipula en <em>rango dividido</em>: primero la agitación (0–70 % de
            su salida) y, cuando llega al máximo, la aireación (70–100 %). El kLa sale de Po, Fl y la correlación de van't Riet.
          </li>
          <li>
            <strong>Temperatura:</strong> el lazo TIC-102 manipula el agua de la chaqueta para retirar el calor que generan las
            células y el agitador.
          </li>
          <li>
            Presiona <strong>Iniciar</strong>, cambia setpoints o pasa un lazo a <strong>Manual</strong> y observa la respuesta.
            Prueba las <strong>perturbaciones</strong> para ver cómo reacciona el control y qué alarmas se disparan.
          </li>
          <li>
            Con E. coli verás que, al crecer la biomasa, el control llega al máximo y el proceso queda <em>limitado por
            oxígeno</em>: es el problema clásico del escalamiento. Prueba el lote alimentado para controlar el crecimiento.
          </li>
        </ul>
      </details>

      <div className="sim-toolbar">
        <button className={`btn ${running ? "" : "btn-primary"}`} onClick={() => setRunning((r) => !r)} disabled={sim.hours >= duration}>
          {sim.hours >= duration ? "✓ Terminada" : running ? "⏸ Pausar" : sim.t > 0 ? "▶ Continuar" : "▶ Iniciar"}
        </button>
        <button className="btn" onClick={() => restart()}>
          ↺ Reiniciar
        </button>
        <button className="btn" onClick={runToEnd} disabled={sim.hours >= duration}>
          ⏭ Simular hasta el final
        </button>
        <label className="inline-field">
          Velocidad
          <select className="input select" value={speed} onChange={(e) => setSpeed(+e.target.value)}>
            {SPEEDS.map((s) => (
              <option key={s.v} value={s.v}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-field">
          Duración
          <select className="input select" value={duration} onChange={(e) => setDuration(+e.target.value)}>
            {[12, 24, 48].map((h) => (
              <option key={h} value={h}>
                {h} h
              </option>
            ))}
          </select>
        </label>
        <div className="sim-clock" aria-live="off">
          <span>
            t = <strong>{sim.hours.toFixed(2)} h</strong> de {duration} h
          </span>
          <span className="progress">
            <span style={{ width: `${Math.min(100, (100 * sim.hours) / duration)}%` }} />
          </span>
        </div>
        <button className="btn btn-sm" onClick={downloadCsv} disabled={hist.length < 2}>
          Descargar CSV
        </button>
      </div>
      {needsRestart && (
        <div className="alert alert-warn">
          Cambiaste el organismo o las condiciones iniciales: presiona <strong>Reiniciar</strong> para aplicarlos.
        </div>
      )}

      <div className="sim-grid">
        <div className="sim-main">
          <div className="panel synoptic-panel">
            <Synoptic
              d={{
                cfg: sim.cfg, tr, X: sim.x.X, S: sim.x.S, V: sim.x.V, T: sim.x.T,
                rpm: sim.u.rpm, vvm: sim.u.vvm, Tj: sim.u.Tj, F: sim.u.F,
                doRead, tRead: sim.tMeas, doOut: sim.doPid.out, tOut: sim.tPid.out,
                running, alarms: activeCodes,
              }}
            />
          </div>

          <div className="panel kpis">
            <h3>El tanque en este instante</h3>
            <p className="muted small">Los mismos números adimensionales del análisis Π, calculados en vivo.</p>
            <div className="kpi-grid">
              <Kpi label={<><Sym s="Re" /> agitación</>} value={formatValue(tr.Re, 3)} hint={tr.Re > 1e4 ? "turbulento" : tr.Re > 10 ? "transición" : "laminar"} />
              <Kpi label={<Sym s="Fl" />} value={formatValue(tr.Fl, 2)} hint={`inunda en ${formatValue(tr.FlFlood, 2)}`} warn={tr.flooded} />
              <Kpi label={<><Sym s="P_g" />/P</>} value={formatValue(tr.PgP, 2)} hint="efecto del gas en la potencia" />
              <Kpi label="P/V" value={`${formatValue(tr.PV, 3)} W/m³`} hint="potencia por volumen" />
              <Kpi
                label="Vel. de punta"
                value={`${formatValue(tr.tip, 2)} m/s`}
                hint={sim.cfg.organism.tipLimit ? `límite ${sim.cfg.organism.tipLimit} m/s` : "π·N·D"}
                warn={!!sim.cfg.organism.tipLimit && tr.tip > sim.cfg.organism.tipLimit - 0.01}
              />
              <Kpi label={<Sym s="k_La" />} value={`${formatValue(tr.kLa * 3600, 3)} 1/h`} hint="van't Riet" />
              <Kpi label="OTR máx." value={`${formatValue(OTRmax, 3)} g/L/h`} hint="kLa · C*" />
              <Kpi label="OUR" value={`${formatValue(OUR, 3)} g/L/h`} hint="consumo de O₂" warn={OUR > 0.9 * OTRmax} />
              <Kpi label="μ" value={`${formatValue(mu, 2)} 1/h`} hint={`μmax ${sim.cfg.organism.muMax} 1/h`} />
            </div>
          </div>
        </div>

        <div className="sim-side">
          <LoopPanel
            title="Oxígeno disuelto"
            tag="AIC-101"
            unit="%"
            settings={cfg.doLoop}
            pv={doRead}
            out={sim.doPid.out}
            P={sim.doPid.P}
            I={sim.doPid.I}
            D={sim.doPid.D}
            spRange={[5, 80]}
            spStep={1}
            outputText={`→ agitación ${formatValue(sr.rpm, 3)} rpm${sim.cfg.organism.tipLimit && sim.u.rpm < sr.rpm - 1 ? ` (limitada a ${formatValue(sim.u.rpm, 3)})` : ""}, aire ${formatValue(sr.vvm, 2)} vvm`}
            onChange={(doLoop) => updateLive({ doLoop })}
            onSuggested={() => updateLive({ doLoop: { ...suggestedDOTuning(cfg.doLoop.sp), mode: cfg.doLoop.mode, manual: cfg.doLoop.manual } })}
            help="El OD responde en segundos a la agitación (1/kLa ≈ 20–60 s) y el electrodo tarda ≈ 20 s: una Kp alta con Ti corto hace oscilar la agitación."
          />
          <LoopPanel
            title="Temperatura"
            tag="TIC-102"
            unit="°C"
            settings={cfg.tLoop}
            pv={sim.tMeas}
            out={sim.tPid.out}
            P={sim.tPid.P}
            I={sim.tPid.I}
            D={sim.tPid.D}
            spRange={[20, 45]}
            spStep={0.5}
            outputText={`→ agua de chaqueta a ${jacketTemp(sim.tPid.out).toFixed(1)} °C`}
            onChange={(tLoop) => updateLive({ tLoop })}
            onSuggested={() => updateLive({ tLoop: { ...suggestedTTuning(cfg.tLoop.sp), mode: cfg.tLoop.mode, manual: cfg.tLoop.manual } })}
            help="La temperatura es lenta (constante de tiempo de decenas de minutos por la masa de líquido): admite Kp alta, pero un Ti muy corto produce sobrepaso."
          />

          <section className="disturbances">
            <h3>Perturbaciones</h3>
            <div className="dist-grid">
              {DISTURBANCES.map((d) => (
                <button
                  key={d.kind}
                  className={`btn btn-sm ${d.kind === "do_drift" && sim.doOffset ? "btn-active" : ""}`}
                  title={d.description}
                  onClick={() => {
                    sim.trigger(d.kind);
                    rerender();
                  }}
                >
                  {d.kind === "do_drift" && sim.doOffset ? "Recalibrar electrodo de OD" : d.label}
                </button>
              ))}
            </div>
          </section>

          <AlarmPanel
            alarms={sim.alarms}
            onAck={(id) => {
              sim.acknowledge(id);
              rerender();
            }}
          />
        </div>
      </div>

      <section className="panel sim-charts">
        <h2>Tendencias</h2>
        <p className="muted small">Pasa el cursor sobre una gráfica: el cursor se sincroniza en todas.</p>
        <div className="tchart-grid">
          <TimeChart
            title="Oxígeno disuelto" unit="%" data={hist} tMax={tMax} yFixed={[0, 100]} hoverT={hoverT} onHover={setHoverT}
            series={[
              { key: "m", label: "Medido", kind: "c1", get: (h) => h.DOmeas },
              { key: "r", label: "Real", kind: "c2", get: (h) => h.DO },
              { key: "sp", label: "Setpoint", kind: "sp", get: (h) => h.DOsp },
            ]}
          />
          <TimeChart
            title="Temperatura" unit="°C" data={hist} tMax={tMax} hoverT={hoverT} onHover={setHoverT}
            series={[
              { key: "m", label: "Caldo", kind: "c1", get: (h) => h.T },
              { key: "j", label: "Chaqueta", kind: "c2", get: (h) => h.Tj },
              { key: "sp", label: "Setpoint", kind: "sp", get: (h) => h.Tsp },
            ]}
          />
          <TimeChart
            title="Biomasa y sustrato" unit="g/L" data={hist} tMax={tMax} hoverT={hoverT} onHover={setHoverT}
            series={[
              { key: "x", label: "Biomasa X", kind: "c1", get: (h) => h.X },
              { key: "s", label: "Sustrato S", kind: "c2", get: (h) => h.S },
            ]}
          />
          <TimeChart
            title="Transferencia de oxígeno" unit="g/L/h" data={hist} tMax={tMax} hoverT={hoverT} onHover={setHoverT}
            series={[
              { key: "otr", label: "OTR (transferido)", kind: "c1", get: (h) => h.OTR },
              { key: "our", label: "OUR (consumido)", kind: "c2", get: (h) => h.OUR },
            ]}
          />
          <TimeChart
            title="Agitación" unit="rpm" data={hist} tMax={tMax} hoverT={hoverT} onHover={setHoverT} digits={3}
            series={[{ key: "n", label: "N", kind: "c1", get: (h) => h.rpm }]}
          />
          <TimeChart
            title="Aireación" unit="vvm" data={hist} tMax={tMax} hoverT={hoverT} onHover={setHoverT}
            series={[{ key: "q", label: "Aire", kind: "c1", get: (h) => h.vvm }]}
          />
        </div>
      </section>

      <section className="panel sim-config">
        <h2>Configuración del proceso</h2>
        <div className="config-grid">
          <fieldset>
            <legend>Organismo</legend>
            <select
              className="input"
              value={cfg.organism.id}
              onChange={(e) => {
                const org = ORGANISMS.find((o) => o.id === e.target.value)!;
                setCfg({ ...cfg, organism: org, T0: org.Topt, tLoop: { ...cfg.tLoop, sp: org.Topt } });
              }}
            >
              {ORGANISMS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <p className="muted small">{cfg.organism.description}</p>
            <p className="muted small">
              μmax {cfg.organism.muMax} 1/h · Ks {cfg.organism.Ks} g/L · Yx/s {cfg.organism.Yxs} · Yx/o {cfg.organism.Yxo} · T óptima{" "}
              {cfg.organism.Topt} °C
            </p>
          </fieldset>

          <fieldset>
            <legend>Condiciones iniciales (al reiniciar)</legend>
            <Field label="Volumen inicial" unit="L" value={cfg.V0} onChange={(v) => setCfg({ ...cfg, V0: v })} />
            <Field label="Biomasa inicial X₀" unit="g/L" value={cfg.X0} onChange={(v) => setCfg({ ...cfg, X0: v })} />
            <Field label="Sustrato inicial S₀" unit="g/L" value={cfg.S0} onChange={(v) => setCfg({ ...cfg, S0: v })} />
            <p className="muted small">
              Tanque: D<sub>t</sub> = {formatValue(tankGeometry(cfg).Dt * 100, 3)} cm, impulsor Rushton D = {formatValue(D * 100, 3)} cm (D/D<sub>t</sub> = 1/3).
            </p>
          </fieldset>

          <fieldset>
            <legend>Alimentación (en vivo)</legend>
            <div className="seg">
              <button className={cfg.feedMode === "lote" ? "on" : ""} onClick={() => updateLive({ feedMode: "lote" })}>
                Lote
              </button>
              <button className={cfg.feedMode === "constante" ? "on" : ""} onClick={() => updateLive({ feedMode: "constante" })}>
                Lote alimentado
              </button>
            </div>
            {cfg.feedMode === "constante" && (
              <>
                <Field label="Flujo de alimentación" unit="L/h" value={cfg.feedRate} onChange={(v) => updateLive({ feedRate: v })} />
                <Field label="Inicia a las" unit="h" value={cfg.feedStart} onChange={(v) => updateLive({ feedStart: v })} />
                <Field label="Sustrato en la alimentación" unit="g/L" value={cfg.Sf} onChange={(v) => updateLive({ Sf: v })} />
              </>
            )}
            <Field label="Volumen máximo (enclavamiento)" unit="L" value={cfg.Vmax} onChange={(v) => updateLive({ Vmax: v })} />
          </fieldset>

          <fieldset>
            <legend>Actuadores (en vivo)</legend>
            <Field label="Agitación mínima" unit="rpm" value={cfg.Nmin} onChange={(v) => updateLive({ Nmin: v })} />
            <Field label="Agitación máxima" unit="rpm" value={cfg.Nmax} onChange={(v) => updateLive({ Nmax: v })} />
            <Field label="Aireación mínima" unit="vvm" value={cfg.vvmMin} onChange={(v) => updateLive({ vvmMin: v })} />
            <Field label="Aireación máxima" unit="vvm" value={cfg.vvmMax} onChange={(v) => updateLive({ vvmMax: v })} />
            <label className="check">
              <input type="checkbox" checked={cfg.noise} onChange={(e) => updateLive({ noise: e.target.checked })} /> Ruido en los sensores
            </label>
          </fieldset>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, hint, warn }: { label: React.ReactNode; value: string; hint: string; warn?: boolean }) {
  return (
    <div className={`kpi ${warn ? "kpi-warn" : ""}`}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-hint">
        {warn && "▲ "}
        {hint}
      </span>
    </div>
  );
}

function Field({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="cfg-field">
      <span>{label}</span>
      <span className="cfg-input">
        <input
          className="input"
          type="number"
          step="any"
          min={0}
          defaultValue={value}
          key={value}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v) && v >= 0 && v !== value) onChange(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  );
}
