import { PIDSettings } from "../../core";

interface Props {
  title: string;
  tag: string;
  unit: string;
  settings: PIDSettings;
  pv: number;
  out: number;
  P: number;
  I: number;
  D: number;
  spRange: [number, number];
  spStep: number;
  outputText: string;
  onChange: (s: PIDSettings) => void;
  onSuggested: () => void;
  help: string;
}

function Num({ label, value, onChange, step, title }: { label: string; value: number; onChange: (v: number) => void; step: number; title: string }) {
  return (
    <label className="pid-field" title={title}>
      <span>{label}</span>
      <input
        className="input"
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && v >= 0) onChange(v);
        }}
      />
    </label>
  );
}

export function LoopPanel(p: Props) {
  const s = p.settings;
  const set = (patch: Partial<PIDSettings>) => p.onChange({ ...s, ...patch });
  const err = s.sp - p.pv;

  return (
    <section className="loop">
      <header className="loop-head">
        <div>
          <span className="loop-tag">{p.tag}</span>
          <strong>{p.title}</strong>
        </div>
        <div className="seg" role="radiogroup" aria-label="Modo del controlador">
          <button className={s.mode === "auto" ? "on" : ""} onClick={() => set({ mode: "auto" })} role="radio" aria-checked={s.mode === "auto"}>
            Automático
          </button>
          <button
            className={s.mode === "manual" ? "on" : ""}
            onClick={() => set({ mode: "manual", manual: Math.round(p.out) })}
            role="radio"
            aria-checked={s.mode === "manual"}
          >
            Manual
          </button>
        </div>
      </header>

      <div className="loop-values">
        <div>
          <span className="lv-label">Medición (PV)</span>
          <span className="lv-value">
            {p.pv.toFixed(1)} <small>{p.unit}</small>
          </span>
        </div>
        <div>
          <span className="lv-label">Setpoint (SP)</span>
          <span className="lv-value">
            {s.mode === "auto" ? s.sp : "—"} <small>{s.mode === "auto" ? p.unit : ""}</small>
          </span>
        </div>
        <div>
          <span className="lv-label">Salida</span>
          <span className="lv-value">
            {p.out.toFixed(0)} <small>%</small>
          </span>
        </div>
      </div>
      <div className="out-bar" aria-hidden>
        <span style={{ width: `${Math.min(100, Math.max(0, p.out))}%` }} />
      </div>
      <p className="muted small loop-out">{p.outputText}</p>

      {s.mode === "auto" ? (
        <label className="slider">
          <span>
            Setpoint: <strong>{s.sp} {p.unit}</strong>
          </span>
          <input type="range" min={p.spRange[0]} max={p.spRange[1]} step={p.spStep} value={s.sp} onChange={(e) => set({ sp: parseFloat(e.target.value) })} />
        </label>
      ) : (
        <label className="slider">
          <span>
            Salida manual: <strong>{s.manual} %</strong>
          </span>
          <input type="range" min={0} max={100} step={1} value={s.manual} onChange={(e) => set({ manual: parseFloat(e.target.value) })} />
        </label>
      )}

      <details className="pid-details">
        <summary>Sintonía PID</summary>
        <div className="pid-grid">
          <Num label="Kp" value={s.Kp} step={0.1} onChange={(v) => set({ Kp: v })} title="Ganancia proporcional (% de salida por unidad de error). Más alta = respuesta más rápida pero más oscilación." />
          <Num label="Ti (s)" value={s.Ti} step={10} onChange={(v) => set({ Ti: v })} title="Tiempo integral. Elimina el error permanente; más pequeño = corrige más rápido pero puede oscilar. 0 = sin acción integral." />
          <Num label="Td (s)" value={s.Td} step={5} onChange={(v) => set({ Td: v })} title="Tiempo derivativo. Anticipa cambios; amplifica el ruido del sensor." />
          <button className="btn btn-sm" onClick={p.onSuggested}>
            Sintonía sugerida
          </button>
        </div>
        <div className="pid-terms">
          <span>error = {err.toFixed(2)}</span>
          <span>P = {p.P.toFixed(1)}</span>
          <span>I = {p.I.toFixed(1)}</span>
          <span>D = {p.D.toFixed(1)}</span>
        </div>
        <p className="muted small">{p.help}</p>
      </details>
    </section>
  );
}
