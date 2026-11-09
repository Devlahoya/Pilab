/**
 * Sinóptico del biorreactor al estilo de un diagrama de tubería e
 * instrumentación (P&ID) con nomenclatura ISA-5.1:
 *   AT/AIC-101  analizador / controlador de oxígeno disuelto
 *   TT/TIC-102  transmisor / controlador de temperatura
 *   SIC-103     velocidad del agitador
 *   FIC-104     flujo de aire
 *   P-101       bomba de alimentación      LAHH-105 alarma de nivel muy alto
 * Las líneas punteadas son señales eléctricas; las continuas, tuberías.
 */
import { ReactorConfig, Transport } from "../../core";
import { formatValue } from "../format";

export interface SynopticData {
  cfg: ReactorConfig;
  tr: Transport;
  X: number; S: number; V: number; T: number;
  rpm: number; vvm: number; Tj: number; F: number;
  doRead: number; tRead: number;
  doOut: number; tOut: number;
  running: boolean;
  alarms: Set<string>;
}

function Bubble({ x, y, tag, num, alarm }: { x: number; y: number; tag: string; num: string; alarm?: boolean }) {
  return (
    <g className={alarm ? "isa isa-alarm" : "isa"}>
      <circle cx={x} cy={y} r="17" />
      <line x1={x - 17} x2={x + 17} y1={y} y2={y} className="isa-panel" />
      <text x={x} y={y - 4} textAnchor="middle" className="isa-tag">
        {tag}
      </text>
      <text x={x} y={y + 11} textAnchor="middle" className="isa-num">
        {num}
      </text>
    </g>
  );
}

function Readout({ x, y, lines, anchor = "start" }: { x: number; y: number; lines: string[]; anchor?: "start" | "end" | "middle" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="ro">
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i ? 15 : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

/** Color de la chaqueta: azul si enfría, rojo si calienta. */
function jacketClass(Tj: number, T: number) {
  if (Tj < T - 0.5) return "jk-cold";
  if (Tj > T + 0.5) return "jk-hot";
  return "jk-neutral";
}

export function Synoptic({ d }: { d: SynopticData }) {
  const { cfg } = d;
  const top = 74, bottom = 316, left = 206, right = 334;
  const vDisplay = cfg.Vmax * 1.1;
  const level = bottom - ((bottom - top) * Math.min(d.V, vDisplay)) / vDisplay;
  const levelMax = bottom - ((bottom - top) * cfg.Vmax) / vDisplay;
  const nBubbles = Math.round(Math.min(d.vvm, 2.5) * 7);
  const spinDur = d.rpm > 1 ? Math.max(0.12, (60 / d.rpm) * 6) : 0;
  const has = (c: string) => d.alarms.has(c);

  return (
    <svg viewBox="0 0 560 380" className={`synoptic ${d.running ? "is-running" : ""}`} role="img" aria-label="Diagrama de instrumentación del biorreactor">
      <defs>
        <clipPath id="liq">
          <rect x={left} y={level} width={right - left} height={bottom - level} rx="14" />
        </clipPath>
      </defs>

      {/* ── chaqueta y tanque */}
      <rect x={left - 12} y={120} width={right - left + 24} height={bottom - 120 + 12} rx="22" className={`jacket ${jacketClass(d.Tj, d.T)}`} />
      <rect x={left} y={top - 10} width={right - left} height={bottom - top + 10} rx="16" className="vessel-bg" />
      <rect x={left} y={level} width={right - left} height={bottom - level} rx="14" className="liquid" />
      <path d={`M${left} ${level} H${right}`} className="liquid-top" />
      <rect x={left} y={top - 10} width={right - left} height={bottom - top + 10} rx="16" className="vessel" />
      {/* deflectores */}
      <rect x={left + 3} y={130} width="5" height={170} className="baffle-s" />
      <rect x={right - 8} y={130} width="5" height={170} className="baffle-s" />
      {/* nivel máximo */}
      <line x1={left - 4} x2={right + 4} y1={levelMax} y2={levelMax} className="lvl-max" />
      <Bubble x={left - 58} y={levelMax} tag="LAHH" num="105" alarm={has("level_high")} />
      <line x1={left - 41} x2={left - 4} y1={levelMax} y2={levelMax} className="signal" />

      {/* burbujas */}
      <g clipPath="url(#liq)">
        {Array.from({ length: nBubbles }, (_, i) => {
          const x = left + 30 + ((i * 37) % (right - left - 60));
          return (
            <circle
              key={i}
              cx={x}
              cy={bottom - 12}
              r={2 + (i % 3)}
              className="sim-bubble"
              style={{ animationDelay: `${(i * 0.37) % 2.4}s`, animationDuration: `${2.2 + (i % 4) * 0.3}s` }}
            />
          );
        })}
      </g>

      {/* ── agitador */}
      <rect x="252" y="22" width="36" height="26" rx="4" className="motor-s" />
      <text x="270" y="40" textAnchor="middle" className="isa-tag">M</text>
      <line x1="270" y1="48" x2="270" y2="282" className="shaft-s" />
      <g className="spin" style={spinDur ? { animationDuration: `${spinDur}s` } : { animationPlayState: "paused" }}>
        <rect x="244" y="276" width="52" height="4" className="blade-s" />
        <rect x="244" y="270" width="8" height="16" className="blade-s" />
        <rect x="288" y="270" width="8" height="16" className="blade-s" />
      </g>
      <Bubble x={326} y={30} tag="SIC" num="103" alarm={has("shear")} />
      <line x1="288" y1="35" x2="309" y2="32" className="signal" />
      <Readout x={348} y={26} lines={[`${formatValue(d.rpm, 3)} rpm`, `P/V ${formatValue(d.tr.PV, 3)} W/m³`]} />

      {/* ── aire */}
      <path d={`M24 352 H250 V308`} className={`pipe ${has("air_fail") ? "pipe-fail" : ""}`} />
      <ellipse cx="270" cy="306" rx="24" ry="4" className="sparger-s" />
      <path d="M250 308 H246" className="pipe" />
      <polygon points="150,344 162,352 150,360" className="valve" />
      <polygon points="174,344 162,352 174,360" className="valve" />
      <Bubble x={112} y={326} tag="FIC" num="104" alarm={has("air_fail") || has("flood")} />
      <line x1="129" y1="330" x2="160" y2="346" className="signal" />
      <Readout x={24} y={372} lines={[`Aire: ${formatValue(d.vvm, 3)} vvm   (${formatValue(d.tr.Qg * 60000, 3)} L/min)`]} />
      {has("air_fail") && <text x="200" y="346" className="fail-x">✕</text>}

      {/* ── oxígeno disuelto */}
      <line x1="318" y1="60" x2="318" y2="236" className="probe" />
      <circle cx="318" cy="238" r="4" className="probe-tip" />
      <Bubble x={410} y={128} tag="AT" num="101" alarm={has("do_low")} />
      <line x1="318" y1="128" x2="393" y2="128" className="signal" />
      <g className={`ctrl ${has("do_low") || has("o2_limit") ? "ctrl-alarm" : ""}`}>
        <rect x="446" y="94" width="104" height="70" rx="8" />
        <text x="456" y="112" className="ctrl-title">AIC-101 · OD</text>
        <text x="456" y="129" className="ctrl-line">PV {formatValue(d.doRead, 3)} %</text>
        <text x="456" y="144" className="ctrl-line">SP {cfg.doLoop.mode === "auto" ? `${cfg.doLoop.sp} %` : "manual"}</text>
        <text x="456" y="159" className="ctrl-line">OUT {d.doOut.toFixed(0)} %</text>
      </g>
      <line x1="427" y1="128" x2="446" y2="128" className="signal" />
      {/* salidas del AIC (rango dividido) a motor y válvula de aire */}
      <path d="M498 94 V12 H326 V13" className="signal" />
      <path d="M498 164 V340 H112 V343" className="signal" />

      {/* ── temperatura */}
      <line x1="222" y1="60" x2="222" y2="214" className="probe" />
      <Bubble x={148} y={190} tag="TT" num="102" alarm={has("t_dev") || has("t_high")} />
      <line x1="165" y1="190" x2="222" y2="190" className="signal" />
      <g className={`ctrl ${has("t_high") || has("cool_fail") ? "ctrl-alarm" : ""}`}>
        <rect x="446" y="196" width="104" height="70" rx="8" />
        <text x="456" y="214" className="ctrl-title">TIC-102 · T</text>
        <text x="456" y="231" className="ctrl-line">PV {d.tRead.toFixed(2)} °C</text>
        <text x="456" y="246" className="ctrl-line">SP {cfg.tLoop.mode === "auto" ? `${cfg.tLoop.sp} °C` : "manual"}</text>
        <text x="456" y="261" className="ctrl-line">OUT {d.tOut.toFixed(0)} %</text>
      </g>
      <path d="M148 173 V160 H436 V231 H446" className="signal" />
      {/* agua de chaqueta */}
      <path d={`M${right + 12} 300 H392 V292`} className={`pipe ${has("cool_fail") ? "pipe-fail" : ""}`} />
      <polygon points="384,282 392,292 400,282" className="valve" />
      <path d="M392 282 V276 H498 V266" className="signal" />
      <Readout x={362} y={318} lines={[`Chaqueta ${d.Tj.toFixed(1)} °C`]} />

      {/* ── alimentación */}
      <rect x="22" y="52" width="62" height="70" rx="6" className="feed-tank" />
      <rect x="22" y={52 + 70 * 0.35} width="62" height={70 * 0.65} rx="6" className="feed-liquid" />
      <text x="53" y="46" textAnchor="middle" className="ro-small">Alimentación</text>
      <path d={`M84 110 H120`} className="pipe" />
      <circle cx="134" cy="110" r="14" className={`pump ${d.F > 0 ? "pump-on" : ""}`} />
      <polygon points="128,102 128,118 142,110" className="pump-arrow" />
      <text x="134" y="140" textAnchor="middle" className="ro-small">P-101</text>
      <path d={`M148 110 H190 V60 H${left + 14} V${top}`} className={`pipe ${d.F > 0 ? "pipe-flow" : ""}`} />
      <Readout x={22} y={160} lines={[`F = ${formatValue(d.F, 3)} L/h`, `S_f = ${formatValue(cfg.Sf, 3)} g/L`]} />

      {/* ── estado del caldo */}
      <text x="22" y="236" className="ro-small">Caldo</text>
      <Readout
        x={22}
        y={252}
        lines={[`X = ${formatValue(d.X, 3)} g/L`, `S = ${formatValue(d.S, 3)} g/L`, `V = ${formatValue(d.V, 3)} L`]}
      />
    </svg>
  );
}
