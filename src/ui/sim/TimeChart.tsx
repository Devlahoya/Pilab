import { HistoryPoint } from "../../core";
import { formatValue } from "../format";

export interface Series {
  key: string;
  label: string;
  /** c1 / c2: colores de serie; sp: referencia (setpoint), punteada y neutra. */
  kind: "c1" | "c2" | "sp";
  get: (h: HistoryPoint) => number;
}

interface Props {
  title: string;
  unit: string;
  data: HistoryPoint[];
  series: Series[];
  tMax: number;
  yFixed?: [number, number];
  hoverT: number | null;
  onHover: (t: number | null) => void;
  digits?: number;
}

const W = 420, H = 170, M = { l: 44, r: 10, t: 10, b: 24 };

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const raw = (hi - lo) / n || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toPrecision(10));
  return out;
}

/** Reduce el número de puntos para dibujar (conserva forma general). */
function thin(data: HistoryPoint[], max = 500): HistoryPoint[] {
  if (data.length <= max) return data;
  const k = Math.ceil(data.length / max);
  const out = data.filter((_, i) => i % k === 0);
  if (out[out.length - 1] !== data[data.length - 1]) out.push(data[data.length - 1]);
  return out;
}

export function TimeChart({ title, unit, data, series, tMax, yFixed, hoverT, onHover, digits = 3 }: Props) {
  const pts = thin(data);
  let lo = Infinity, hi = -Infinity;
  for (const p of pts)
    for (const s of series) {
      const v = s.get(p);
      if (Number.isFinite(v)) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    }
  if (yFixed) [lo, hi] = [Math.min(yFixed[0], lo), Math.max(yFixed[1], hi)];
  if (!Number.isFinite(lo)) [lo, hi] = [0, 1];
  if (hi - lo < 1e-9) [lo, hi] = [lo - 1, hi + 1];
  const pad = (hi - lo) * 0.08;
  if (!yFixed) [lo, hi] = [lo - pad, hi + pad];

  const sx = (t: number) => M.l + (t / tMax) * (W - M.l - M.r);
  const sy = (v: number) => H - M.b - ((v - lo) / (hi - lo)) * (H - M.t - M.b);
  const yt = niceTicks(lo, hi);
  const xt = niceTicks(0, tMax, 6);

  const path = (s: Series) => {
    let d = "";
    let pen = false;
    for (const p of pts) {
      const v = s.get(p);
      if (!Number.isFinite(v)) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(p.t).toFixed(1)} ${sy(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  // Punto más cercano al cursor
  let hp: HistoryPoint | null = null;
  if (hoverT !== null && data.length) {
    let best = Infinity;
    for (const p of data) {
      const d = Math.abs(p.t - hoverT);
      if (d < best) {
        best = d;
        hp = p;
      }
    }
    if (hp && Math.abs(hp.t - hoverT) > tMax / 50) hp = null;
  }

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    const t = ((x - M.l) / (W - M.l - M.r)) * tMax;
    onHover(t >= 0 && t <= tMax ? t : null);
  };

  return (
    <figure className="tchart">
      <figcaption>
        <strong>{title}</strong> <span className="muted">({unit})</span>
        {series.length > 1 && (
          <span className="tchart-legend">
            {series.map((s) => (
              <span key={s.key} className="legend-item">
                <svg width="18" height="10" aria-hidden>
                  <line x1="1" y1="5" x2="17" y2="5" className={`tl-${s.kind}`} />
                </svg>
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div className="tchart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" onMouseMove={onMove} onMouseLeave={() => onHover(null)} role="img" aria-label={`${title} contra el tiempo`}>
          {yt.map((v) => (
            <g key={`y${v}`}>
              <line x1={M.l} x2={W - M.r} y1={sy(v)} y2={sy(v)} className="c-grid" />
              <text x={M.l - 5} y={sy(v) + 4} textAnchor="end" className="c-tick">
                {formatValue(v, 3)}
              </text>
            </g>
          ))}
          {xt.map((t) => (
            <text key={`x${t}`} x={sx(t)} y={H - 6} textAnchor="middle" className="c-tick">
              {t} h
            </text>
          ))}
          <line x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} className="c-axis" />
          {series.map((s) => (
            <path key={s.key} d={path(s)} className={`tl-${s.kind}`} />
          ))}
          {hp && (
            <>
              <line x1={sx(hp.t)} x2={sx(hp.t)} y1={M.t} y2={H - M.b} className="crosshair" />
              {series
                .filter((s) => s.kind !== "sp" && Number.isFinite(s.get(hp!)))
                .map((s) => (
                  <circle key={s.key} cx={sx(hp!.t)} cy={sy(s.get(hp!))} r={4} className={`td-${s.kind}`} />
                ))}
            </>
          )}
        </svg>
        {hp && (
          <div className="chart-tip tchart-tip" style={{ left: `${(sx(hp.t) / W) * 100}%`, transform: sx(hp.t) > W * 0.6 ? "translateX(-105%)" : "translateX(8px)" }}>
            <div>t = {hp.t.toFixed(2)} h</div>
            {series.map((s) =>
              Number.isFinite(s.get(hp!)) ? (
                <div key={s.key}>
                  {s.label}: {formatValue(s.get(hp!), digits)} {unit}
                </div>
              ) : null,
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
