import { ReactNode, useId, useRef, useState } from "react";
import { formatValue } from "./format";

export interface ChartPoint {
  x: number;
  y: number;
  /** Texto del tooltip (líneas). */
  info: string[];
}

interface Props {
  points: ChartPoint[];
  /** Curva continua (se dibuja con la serie 2). */
  curve?: (x: number) => number;
  curveLabel?: string;
  /** Diagonal y = x con bandas ±pct (gráfica de paridad). */
  parity?: number;
  xLabel: ReactNode;
  yLabel: ReactNode;
  pointsLabel?: string;
  ariaLabel: string;
}

const W = 440, H = 300, M = { l: 58, r: 14, t: 12, b: 42 };

function logDomain(vals: number[]): [number, number] {
  const lo = Math.min(...vals), hi = Math.max(...vals);
  if (lo === hi) return [lo / 2, hi * 2];
  const pad = Math.pow(hi / lo, 0.06);
  return [lo / pad, hi * pad];
}

function logTicks([lo, hi]: [number, number]): number[] {
  const d0 = Math.floor(Math.log10(lo)), d1 = Math.ceil(Math.log10(hi));
  const pick = (mult: number[]) => {
    const out: number[] = [];
    for (let d = d0; d <= d1; d++) for (const m of mult) {
      const v = m * Math.pow(10, d);
      if (v >= lo && v <= hi) out.push(v);
    }
    return out;
  };
  let t = pick([1]);
  if (t.length < 3) t = pick([1, 2, 5]);
  if (t.length < 3) t = pick([1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9]);
  if (t.length > 7) t = t.filter((_, i) => i % Math.ceil(t.length / 6) === 0);
  if (t.length < 3) {
    // Rango estrecho (menos de una década): marcas lineales "redondas"
    const raw = (hi - lo) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
    t = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-12; v += step) t.push(+v.toPrecision(10));
  }
  return t;
}

export function LogChart({ points, curve, curveLabel, parity, xLabel, yLabel, pointsLabel = "Experimentos", ariaLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const clipId = `clip${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (!points.length) return null;

  let xd = logDomain(points.map((p) => p.x));
  let yd = logDomain(points.map((p) => p.y));
  if (parity) {
    const all = logDomain([...points.map((p) => p.x), ...points.map((p) => p.y)]);
    xd = all;
    yd = all;
  }
  const sx = (x: number) => M.l + ((Math.log(x) - Math.log(xd[0])) / (Math.log(xd[1]) - Math.log(xd[0]))) * (W - M.l - M.r);
  const sy = (y: number) => H - M.b - ((Math.log(y) - Math.log(yd[0])) / (Math.log(yd[1]) - Math.log(yd[0]))) * (H - M.t - M.b);
  /** Quita marcas demasiado juntas (en píxeles) para que las etiquetas no se encimen. */
  const spaced = (ticks: number[], pos: (v: number) => number, minGap: number) => {
    const out: number[] = [];
    for (const t of ticks) if (!out.length || Math.abs(pos(t) - pos(out[out.length - 1])) >= minGap) out.push(t);
    return out;
  };
  const xt = spaced(logTicks(xd), sx, 46), yt = spaced(logTicks(yd), sy, 20);

  const lineThrough = (f: (x: number) => number) => {
    const n = 60;
    const pts: string[] = [];
    for (let i = 0; i <= n; i++) {
      const x = Math.exp(Math.log(xd[0]) + (i / n) * (Math.log(xd[1]) - Math.log(xd[0])));
      const y = f(x);
      if (y > 0 && Number.isFinite(y)) pts.push(`${sx(x).toFixed(1)},${sy(Math.min(Math.max(y, yd[0] / 10), yd[1] * 10)).toFixed(1)}`);
    }
    return pts.join(" ");
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart" ref={wrap}>
      <div className="chart-legend" aria-hidden>
        <span className="legend-item">
          <svg width="12" height="12"><circle cx="6" cy="6" r="4.5" className="c-dot" /></svg>
          {pointsLabel}
        </span>
        {(curve || parity) && (
          <span className="legend-item">
            <svg width="18" height="12"><line x1="1" y1="6" x2="17" y2="6" className="c-line" /></svg>
            {curveLabel ?? (parity ? "Predicción perfecta" : "Correlación")}
          </span>
        )}
        {parity && (
          <span className="legend-item">
            <svg width="18" height="12"><line x1="1" y1="6" x2="17" y2="6" className="c-band" /></svg>±{parity} %
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {/* rejilla */}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} className="c-grid" />
            <text x={sx(t)} y={H - M.b + 16} textAnchor="middle" className="c-tick">{formatValue(t, 2)}</text>
          </g>
        ))}
        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} className="c-grid" />
            <text x={M.l - 6} y={sy(t) + 4} textAnchor="end" className="c-tick">{formatValue(t, 2)}</text>
          </g>
        ))}
        <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="c-axis" />
        <line x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} className="c-axis" />

        <clipPath id={clipId}>
          <rect x={M.l} y={M.t} width={W - M.l - M.r} height={H - M.t - M.b} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {parity && (
            <>
              <polyline points={lineThrough((x) => x * (1 + parity / 100))} className="c-band" />
              <polyline points={lineThrough((x) => x * (1 - parity / 100))} className="c-band" />
              <polyline points={lineThrough((x) => x)} className="c-line" />
            </>
          )}
          {curve && <polyline points={lineThrough(curve)} className="c-line" />}
        </g>

        {points.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r={hover === i ? 6 : 4.5} className="c-dot" />
            <circle
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={12}
              className="c-hit"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              tabIndex={0}
              aria-label={p.info.join(", ")}
            />
          </g>
        ))}
      </svg>
      <div className="chart-xlabel">{xLabel}</div>
      <div className="chart-ylabel">{yLabel}</div>
      {hp && (
        <div
          className="chart-tip"
          style={{
            left: `${(sx(hp.x) / W) * 100}%`,
            top: `${(sy(hp.y) / H) * 100}%`,
            transform: `translate(${sx(hp.x) > W * 0.6 ? "-105%" : "8%"}, -110%)`,
          }}
        >
          {hp.info.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}
