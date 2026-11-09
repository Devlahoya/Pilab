import { Alarm, AlarmLevel } from "../../core";

const ICON: Record<AlarmLevel, string> = { crítica: "⛔", alta: "▲", aviso: "▲", info: "ℹ" };
const LABEL: Record<AlarmLevel, string> = { crítica: "Crítica", alta: "Alta", aviso: "Aviso", info: "Info" };

const fmtT = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")} h`;
};

export function AlarmPanel({ alarms, onAck }: { alarms: Alarm[]; onAck: (id?: number) => void }) {
  const active = alarms.filter((a) => a.tOff === undefined);
  const unacked = alarms.filter((a) => !a.acked).length;
  return (
    <section className="alarms">
      <header className="alarms-head">
        <h3>
          Alarmas{" "}
          {active.length > 0 && <span className="badge badge-alarm">{active.length} activas</span>}
        </h3>
        {unacked > 0 && (
          <button className="btn btn-sm" onClick={() => onAck()}>
            Reconocer todas ({unacked})
          </button>
        )}
      </header>
      {alarms.length === 0 ? (
        <p className="muted small">Sin alarmas. Prueba una perturbación para ver cómo responde el sistema.</p>
      ) : (
        <ul className="alarm-list">
          {alarms.slice(0, 40).map((a) => (
            <li
              key={a.id}
              className={`alarm lvl-${a.level === "crítica" ? "crit" : a.level === "alta" ? "high" : a.level === "aviso" ? "warn" : "info"} ${a.tOff === undefined ? "is-active" : "is-cleared"} ${a.acked ? "" : "is-unacked"}`}
            >
              <span className="alarm-icon" aria-hidden>
                {ICON[a.level]}
              </span>
              <span className="alarm-body">
                <span className="alarm-meta">
                  <strong>{LABEL[a.level]}</strong> · {fmtT(a.tOn)}
                  {a.tOff !== undefined ? ` → normalizada ${fmtT(a.tOff)}` : " · activa"}
                </span>
                <span>{a.message}</span>
              </span>
              {!a.acked && (
                <button className="btn btn-sm btn-ghost" onClick={() => onAck(a.id)}>
                  Reconocer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
