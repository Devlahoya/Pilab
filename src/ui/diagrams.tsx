/**
 * Esquemas SVG de cada proceso.
 *
 * Las etiquetas salen de las variables del análisis (por tipo de magnitud):
 * si el usuario quita una variable, su cota desaparece del esquema; si cambia
 * su símbolo, el esquema lo refleja.
 */
import { ReactNode, useId } from "react";

export type Labels = (kindId: string) => string | null;

interface DProps {
  L: Labels;
  compact?: boolean;
}

/* ───────────────────────── utilidades */

function Txt({ x, y, s, anchor = "middle", cls = "lbl" }: { x: number; y: number; s: string | null; anchor?: "start" | "middle" | "end"; cls?: string }) {
  if (!s) return null;
  const i = s.indexOf("_");
  return (
    <text x={x} y={y} textAnchor={anchor} className={cls}>
      {i > 0 ? (
        <>
          {s.slice(0, i)}
          <tspan className="lbl-sub" dy="4">
            {s.slice(i + 1)}
          </tspan>
        </>
      ) : (
        s
      )}
    </text>
  );
}

function useMarkers() {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ids = { arrow: `a${raw}`, dim: `d${raw}`, acc: `c${raw}`, hot: `h${raw}` };
  const defs = (
    <defs>
      <marker id={ids.arrow} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="mk-line" />
      </marker>
      <marker id={ids.dim} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="mk-dim" />
      </marker>
      <marker id={ids.acc} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="mk-acc" />
      </marker>
      <marker id={ids.hot} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" className="mk-hot" />
      </marker>
    </defs>
  );
  const url = (k: keyof typeof ids) => `url(#${ids[k]})`;
  return { defs, url };
}

/** Cota con flechas en ambos extremos y etiqueta. */
function Dim({ x1, y1, x2, y2, label, lx, ly, url, anchor }: { x1: number; y1: number; x2: number; y2: number; label: string | null; lx?: number; ly?: number; url: (k: "dim") => string; anchor?: "start" | "middle" | "end" }) {
  if (!label) return null;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className="dim" markerStart={url("dim")} markerEnd={url("dim")} />
      <Txt x={lx ?? (x1 + x2) / 2} y={ly ?? (y1 + y2) / 2 - 5} s={label} cls="lbl lbl-dim" anchor={anchor} />
    </g>
  );
}

/** Leyenda de propiedades del fluido presentes. */
function FluidLegend({ L, x, y, kinds, title = "Fluido" }: { L: Labels; x: number; y: number; kinds: string[]; title?: string }) {
  const syms = kinds.map(L).filter((s): s is string => !!s);
  if (!syms.length) return null;
  return (
    <g>
      <text x={x} y={y} className="lbl-small">
        {title}:
      </text>
      {syms.map((s, i) => (
        <Txt key={s} x={x + 2 + (i % 3) * 30} y={y + 18 + Math.floor(i / 3) * 18} s={s} anchor="start" />
      ))}
    </g>
  );
}

const FLUID_PROPS = ["density", "dynamic_viscosity", "kinematic_viscosity", "surface_tension", "diffusivity", "thermal_conductivity", "specific_heat"];

function Svg({ children, compact, h = 210 }: { children: ReactNode; compact?: boolean; h?: number }) {
  return (
    <svg viewBox={`0 0 320 ${h}`} className={`dg ${compact ? "dg-compact" : ""}`} role="img" aria-label="Esquema del proceso">
      {children}
    </svg>
  );
}

const bubbles = (pts: [number, number, number][]) =>
  pts.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} className="bubble" />);

/* ───────────────────────── tanque agitado / biorreactor */

export function StirredTank({ L, compact, aerated, tracer }: DProps & { aerated?: boolean; tracer?: boolean }) {
  const { defs, url } = useMarkers();
  const tankPath = "M90 30 V168 Q90 186 108 186 H212 Q230 186 230 168 V30";
  const liquid = "M90 52 Q110 47 125 52 T160 52 T195 52 T230 52 V168 Q230 186 212 186 H108 Q90 186 90 168 Z";
  return (
    <Svg compact={compact} h={215}>
      {defs}
      <path d={liquid} className="fluid" />
      <path d={tankPath} className="wall-line" />
      {/* deflectores */}
      <rect x="92" y="62" width="6" height="110" className="baffle" />
      <rect x="222" y="62" width="6" height="110" className="baffle" />
      {/* motor y flecha */}
      <rect x="146" y="4" width="28" height="16" rx="3" className="motor" />
      <Txt x={140} y={17} s={L("power")} anchor="end" />
      <line x1="160" y1="20" x2="160" y2="142" className="shaft" />
      {/* impulsor Rushton */}
      <line x1="138" y1="142" x2="182" y2="142" className="shaft" />
      <rect x="136" y="134" width="9" height="16" className="blade" />
      <rect x="175" y="134" width="9" height="16" className="blade" />
      <rect x="156" y="134" width="8" height="16" className="blade" />
      {/* patrón de circulación */}
      <path d="M190 142 C222 142 224 80 204 70 C196 66 190 68 186 72" className="flow" markerEnd={url("acc")} />
      <path d="M130 142 C98 142 96 80 116 70 C124 66 130 68 134 72" className="flow" markerEnd={url("acc")} />
      {/* rotación */}
      {L("rotational_speed") && (
        <>
          <path d="M146 90 A16 6 0 1 0 174 90" className="rot" markerEnd={url("arrow")} />
          <Txt x={180} y={88} s={L("rotational_speed")} anchor="start" />
        </>
      )}
      <Dim x1={136} y1={126} x2={184} y2={126} label={L("impeller_diameter")} ly={120} url={url} />
      <Dim x1={90} y1={202} x2={230} y2={202} label={L("tank_diameter")} lx={240} ly={206} anchor="start" url={url} />
      {L("liquid_height") && <Dim x1={244} y1={52} x2={244} y2={186} label={L("liquid_height")} lx={250} ly={122} anchor="start" url={url} />}
      {aerated && (
        <>
          <path d="M40 22 H112 V172 H150" className="pipe-gas" />
          <line x1="20" y1="22" x2="58" y2="22" className="arrow-line" markerEnd={url("arrow")} />
          <Txt x={18} y={16} s={L("gas_flow") ?? L("superficial_gas_velocity")} anchor="start" />
          <ellipse cx="160" cy="172" rx="16" ry="3.5" className="sparger" />
          {bubbles([
            [150, 162, 3], [168, 160, 2.5], [158, 154, 2], [196, 122, 3.2], [206, 104, 2.6], [124, 120, 3],
            [114, 102, 2.2], [200, 72, 2.5], [128, 70, 2.8], [178, 64, 2], [148, 76, 2.4], [212, 150, 2.2],
          ])}
          <Txt x={258} y={150} s={L("kla")} anchor="start" />
          {L("kla") && <line x1="256" y1="146" x2="214" y2="132" className="leader" />}
        </>
      )}
      {tracer && (
        <>
          <circle cx="200" cy="58" r="6" className="tracer" />
          <path d="M200 64 C196 80 186 90 190 104" className="tracer-trail" />
          <Txt x={208} y={44} s={L("mixing_time")} anchor="start" />
        </>
      )}
      <FluidLegend L={L} x={4} y={110} kinds={[...FLUID_PROPS, "gravity"]} title="Medio" />
    </Svg>
  );
}

/* ───────────────────────── tubería (fricción, calor o masa) */

export function Pipe({ L, compact, mode }: DProps & { mode: "friction" | "heat" | "mass" }) {
  const { defs, url } = useMarkers();
  const wallCls = mode === "heat" ? "wall-hot" : mode === "mass" ? "wall-mass" : "wall";
  return (
    <Svg compact={compact} h={238}>
      {defs}
      <rect x="30" y="76" width="260" height="56" className="fluid" />
      <rect x="30" y="68" width="260" height="8" className={wallCls} />
      <rect x="30" y="132" width="260" height="8" className={wallCls} />
      {/* perfil de velocidades */}
      <path d="M70 80 Q112 104 70 128" className="profile" />
      {[84, 94, 104, 114, 124].map((y) => {
        const len = 12 + 30 * (1 - Math.pow((y - 104) / 24, 2));
        return <line key={y} x1="70" y1={y} x2={70 + len} y2={y} className="arrow-line thin" markerEnd={url("arrow")} />;
      })}
      <Txt x={122} y={100} s={L("velocity")} anchor="start" />
      <Dim x1={300} y1={76} x2={300} y2={132} label={L("diameter") ?? L("char_length")} lx={306} ly={108} anchor="start" url={url} />
      <Dim x1={40} y1={160} x2={280} y2={160} label={L("pipe_length")} ly={176} url={url} />
      {mode === "friction" && (
        <>
          {[70, 250].map((x, i) => (
            <g key={x}>
              <line x1={x} y1="68" x2={x} y2="48" className="wall-line" />
              <circle cx={x} cy="38" r="10" className="gauge" />
              <line x1={x} y1="38" x2={x + 5} y2="32" className="wall-line thin" />
              <text x={x + (i ? 16 : -16)} y="42" textAnchor={i ? "start" : "end"} className="lbl">
                p<tspan className="lbl-sub" dy="4">{i + 1}</tspan>
              </text>
            </g>
          ))}
          <Txt x={160} y={30} s={L("pressure_drop") ? `${L("pressure_drop")} = p₁ − p₂` : null} />
          {L("roughness") && (
            <>
              <circle cx="200" cy="72" r="14" className="zoom" />
              <path d="M188 76 l4 -5 l3 4 l4 -6 l3 5 l4 -4 l3 5 l3 -3" className="rough" />
              <Txt x={222} y={60} s={L("roughness")} anchor="start" />
            </>
          )}
        </>
      )}
      {mode === "heat" && (
        <>
          {[110, 160, 210, 260].map((x) => (
            <g key={x}>
              <line x1={x} y1="62" x2={x} y2="84" className="heat" markerEnd={url("hot")} />
              <line x1={x} y1="146" x2={x} y2="124" className="heat" markerEnd={url("hot")} />
            </g>
          ))}
          <Txt x={160} y={52} s={L("heat_transfer_coeff") ? `${L("heat_transfer_coeff")} (pared → fluido)` : null} />
        </>
      )}
      {mode === "mass" && (
        <>
          {[110, 160, 210, 260].map((x) => (
            <g key={x}>
              <path d={`M${x} 80 q4 6 0 12`} className="mass" markerEnd={url("acc")} />
              <path d={`M${x} 128 q-4 -6 0 -12`} className="mass" markerEnd={url("acc")} />
            </g>
          ))}
          <Txt x={160} y={52} s={L("mass_transfer_coeff") ? `${L("mass_transfer_coeff")} (superficie → fluido)` : null} />
        </>
      )}
      <FluidLegend L={L} x={4} y={196} kinds={FLUID_PROPS} />
    </Svg>
  );
}

/* ───────────────────────── bomba centrífuga */

export function Pump({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  const cx = 170, cy = 112;
  return (
    <Svg compact={compact}>
      {defs}
      {/* voluta */}
      <path d={`M${cx + 62} ${cy} A62 62 0 1 1 ${cx + 10} ${cy - 61} L${cx + 70} ${cy - 61} L${cx + 70} ${cy - 40} L${cx + 58} ${cy - 40} A58 58 0 0 1 ${cx + 62} ${cy}`} className="volute" />
      <rect x={cx + 10} y={cy - 78} width="60" height="17" className="fluid-solid" />
      <line x1={cx + 74} y1={cy - 70} x2={cx + 110} y2={cy - 70} className="arrow-line" markerEnd={url("arrow")} />
      {/* entrada */}
      <rect x="20" y={cy - 10} width={cx - 50} height="20" className="fluid-solid" />
      <line x1="26" y1={cy} x2="80" y2={cy} className="arrow-line" markerEnd={url("arrow")} />
      <Txt x={40} y={cy - 16} s={L("volumetric_flow")} anchor="start" />
      {/* rodete */}
      <circle cx={cx} cy={cy} r="38" className="impeller" />
      {[0, 60, 120, 180, 240, 300].map((a) => {
        const r = (a * Math.PI) / 180;
        const x1 = cx + 10 * Math.cos(r), y1 = cy + 10 * Math.sin(r);
        const x2 = cx + 36 * Math.cos(r + 0.7), y2 = cy + 36 * Math.sin(r + 0.7);
        return <path key={a} d={`M${x1} ${y1} Q${cx + 26 * Math.cos(r + 0.15)} ${cy + 26 * Math.sin(r + 0.15)} ${x2} ${y2}`} className="blade-line" />;
      })}
      <circle cx={cx} cy={cy} r="6" className="hub" />
      {L("rotational_speed") && (
        <>
          <path d={`M${cx - 24} ${cy + 46} A30 12 0 0 0 ${cx + 24} ${cy + 46}`} className="rot" markerEnd={url("arrow")} />
          <Txt x={cx + 30} y={cy + 64} s={L("rotational_speed")} anchor="start" />
        </>
      )}
      <Dim x1={cx - 38} y1={cy + 84} x2={cx + 38} y2={cy + 84} label={L("impeller_diameter")} ly={cy + 80} url={url} />
      {L("pressure_drop") && (
        <>
          <text x="22" y={cy + 30} className="lbl">p<tspan className="lbl-sub" dy="4">1</tspan></text>
          <text x={cx + 112} y={cy - 78} className="lbl">p<tspan className="lbl-sub" dy="4">2</tspan></text>
          <Txt x={258} y={cy + 6} s={`${L("pressure_drop")} = p₂ − p₁`} />
        </>
      )}
      <FluidLegend L={L} x={4} y={170} kinds={FLUID_PROPS} />
    </Svg>
  );
}

/* ───────────────────────── esfera en un flujo */

export function SphereDrag({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  const cx = 170, cy = 100, r = 26;
  return (
    <Svg compact={compact} h={222}>
      {defs}
      <rect x="0" y="20" width="320" height="160" className="fluid" />
      {[-60, -36, -14, 14, 36, 60].map((dy) => {
        const k = Math.max(0, 1 - Math.abs(dy) / 70);
        const bump = (dy > 0 ? 1 : -1) * 30 * k;
        return <path key={dy} d={`M20 ${cy + dy} C110 ${cy + dy} 130 ${cy + dy + bump} ${cx} ${cy + dy + bump} S230 ${cy + dy} 310 ${cy + dy}`} className="streamline" />;
      })}
      {[64, 100, 136].map((y) => (
        <line key={y} x1="18" y1={y} x2="58" y2={y} className="arrow-line" markerEnd={url("arrow")} />
      ))}
      <Txt x={38} y={52} s={L("velocity")} />
      <path d={`M${cx + r} ${cy - 12} q30 12 0 24`} className="wake" />
      <circle cx={cx} cy={cy} r={r} className="solid" />
      {L("drag_force") && (
        <>
          <line x1={cx} y1={cy} x2={cx + 72} y2={cy} className="force" markerEnd={url("acc")} />
          <Txt x={cx + 78} y={cy + 4} s={L("drag_force")} anchor="start" />
        </>
      )}
      <Dim x1={cx - 40} y1={cy - r} x2={cx - 40} y2={cy + r} label={L("particle_diameter")} lx={cx - 46} ly={cy + 4} anchor="end" url={url} />
      <FluidLegend L={L} x={4} y={194} kinds={FLUID_PROPS} />
    </Svg>
  );
}

/* ───────────────────────── partícula o burbuja en una columna de líquido */

export function Column({ L, compact, bubble }: DProps & { bubble?: boolean }) {
  const { defs, url } = useMarkers();
  return (
    <Svg compact={compact}>
      {defs}
      <rect x="110" y="20" width="110" height="176" className="fluid" />
      <path d="M110 12 V196 H220 V12" className="wall-line" />
      {bubble ? (
        <>
          <ellipse cx="165" cy="118" rx="18" ry="12" className="bubble big" />
          <line x1="165" y1="100" x2="165" y2="56" className="force" markerEnd={url("acc")} />
          <Txt x={172} y={66} s={L("terminal_velocity")} anchor="start" />
          <Dim x1={147} y1={142} x2={183} y2={142} label={L("particle_diameter")} ly={158} url={url} />
          <Txt x={190} y={124} s={L("surface_tension")} anchor="start" />
        </>
      ) : (
        <>
          <circle cx="165" cy="72" r="10" className="solid" />
          <line x1="165" y1="86" x2="165" y2="136" className="force" markerEnd={url("acc")} />
          <Txt x={172} y={124} s={L("terminal_velocity")} anchor="start" />
          <Dim x1={150} y1={56} x2={180} y2={56} label={L("particle_diameter")} ly={50} url={url} />
        </>
      )}
      {L("gravity") && (
        <>
          <line x1="250" y1="60" x2="250" y2="110" className="arrow-line" markerEnd={url("arrow")} />
          <Txt x={258} y={90} s={L("gravity")} anchor="start" />
        </>
      )}
      <FluidLegend L={L} x={4} y={60} kinds={[...FLUID_PROPS, "density_difference"]} title="Sistema" />
    </Svg>
  );
}

/* ───────────────────────── placa vertical (convección natural) */

export function Plate({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  return (
    <Svg compact={compact}>
      {defs}
      <rect x="120" y="24" width="12" height="164" className="wall-hot" />
      <path d="M132 188 C150 150 160 90 182 24 L132 24 Z" className="layer" />
      {[160, 120, 80].map((y, i) => (
        <line key={y} x1={140 + i * 6} y1={y} x2={146 + i * 8} y2={y - 30} className="flow-solid" markerEnd={url("acc")} />
      ))}
      <Dim x1={104} y1={24} x2={104} y2={188} label={L("char_length")} lx={98} ly={110} anchor="end" url={url} />
      <Txt x={126} y={204} s="Tₛ" />
      <Txt x={250} y={60} s="T∞" />
      <Txt x={250} y={84} s={L("temperature_difference") ? `${L("temperature_difference")} = Tₛ − T∞` : null} />
      <Txt x={190} y={150} s={L("heat_transfer_coeff")} anchor="start" />
      {L("gravity") && (
        <>
          <line x1="290" y1="120" x2="290" y2="170" className="arrow-line" markerEnd={url("arrow")} />
          <Txt x={296} y={150} s={L("gravity")} anchor="start" />
        </>
      )}
      <FluidLegend L={L} x={4} y={30} kinds={[...FLUID_PROPS, "thermal_expansion"]} title="Aire" />
    </Svg>
  );
}

/* ───────────────────────── placa que se enfría (conducción transitoria) */

export function Slab({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  const gid = `g${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <Svg compact={compact}>
      {defs}
      <defs>
        <linearGradient id={gid} x1="0" x2="1">
          <stop offset="0" className="cold-stop" />
          <stop offset="0.5" className="hot-stop" />
          <stop offset="1" className="cold-stop" />
        </linearGradient>
      </defs>
      <rect x="110" y="40" width="100" height="140" fill={`url(#${gid})`} className="slab" />
      <path d="M110 150 Q160 70 210 150" className="profile" />
      <line x1="160" y1="40" x2="160" y2="180" className="center" />
      {[70, 110, 150].map((y) => (
        <g key={y}>
          <line x1="104" y1={y} x2="70" y2={y} className="heat" markerEnd={url("hot")} />
          <line x1="216" y1={y} x2="250" y2={y} className="heat" markerEnd={url("hot")} />
        </g>
      ))}
      <Txt x={60} y={92} s={L("heat_transfer_coeff")} anchor="end" />
      <Txt x={258} y={92} s={L("heat_transfer_coeff")} anchor="start" />
      <Txt x={258} y={130} s="T∞" anchor="start" />
      <Dim x1={160} y1={28} x2={210} y2={28} label={L("thickness")} ly={22} url={url} />
      <Txt x={160} y={200} s={L("dimensionless") ? `${L("dimensionless")}(${L("time") ?? "t"})` : null} />
      <FluidLegend L={L} x={4} y={30} kinds={["solid_thermal_conductivity", "thermal_diffusivity"]} title="Sólido" />
    </Svg>
  );
}

/* ───────────────────────── columna de burbujeo */

export function BubbleColumn({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  return (
    <Svg compact={compact}>
      {defs}
      <rect x="120" y="30" width="80" height="160" className="fluid" />
      <path d="M120 10 V190 H200 V10" className="wall-line" />
      <ellipse cx="160" cy="180" rx="26" ry="4" className="sparger" />
      <line x1="160" y1="208" x2="160" y2="186" className="arrow-line" markerEnd={url("arrow")} />
      <Txt x={170} y={206} s={L("superficial_gas_velocity") ?? L("gas_flow")} anchor="start" />
      {bubbles([
        [140, 160, 3], [168, 150, 3.5], [152, 132, 2.5], [182, 120, 3], [134, 108, 3.2], [162, 96, 2.6],
        [146, 80, 3], [178, 70, 2.4], [140, 52, 2.8], [170, 44, 3], [188, 156, 2.2], [128, 132, 2],
      ])}
      <Dim x1={120} y1={22} x2={200} y2={22} label={L("tank_diameter")} ly={16} url={url} />
      <Txt x={232} y={110} s={L("kla")} anchor="start" />
      {L("kla") && <line x1="230" y1="106" x2="190" y2="100" className="leader" />}
      <FluidLegend L={L} x={4} y={60} kinds={[...FLUID_PROPS, "gravity"]} title="Líquido" />
    </Svg>
  );
}

/* ───────────────────────── reactor tubular */

export function Reactor({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  return (
    <Svg compact={compact}>
      {defs}
      <rect x="50" y="80" width="220" height="48" className="fluid" />
      <rect x="50" y="72" width="220" height="8" className="wall" />
      <rect x="50" y="128" width="220" height="8" className="wall" />
      <line x1="10" y1="104" x2="46" y2="104" className="arrow-line" markerEnd={url("arrow")} />
      <line x1="274" y1="104" x2="310" y2="104" className="arrow-line" markerEnd={url("arrow")} />
      <text x="10" y="94" className="lbl">C<tspan className="lbl-sub" dy="4">A0</tspan></text>
      <text x="282" y="94" className="lbl">C<tspan className="lbl-sub" dy="4">A</tspan></text>
      <text x="160" y="110" textAnchor="middle" className="lbl-plain">A → B</text>
      <Txt x={160} y={64} s={L("reaction_rate_constant") ? `${L("reaction_rate_constant")} (1er orden)` : null} />
      {L("velocity") && (
        <>
          <line x1="70" y1="118" x2="104" y2="118" className="arrow-line thin" markerEnd={url("arrow")} />
          <Txt x={112} y={122} s={L("velocity")} anchor="start" />
        </>
      )}
      {L("diffusivity") && (
        <>
          <line x1="206" y1="92" x2="244" y2="92" className="flow-solid" markerStart={url("acc")} markerEnd={url("acc")} />
          <Txt x={225} y={122} s={L("diffusivity")} />
        </>
      )}
      <Dim x1={50} y1={156} x2={270} y2={156} label={L("char_length")} ly={172} url={url} />
      <Txt x={160} y={200} s={L("dimensionless") ? `${L("dimensionless")} = 1 − C_A/C_A0` : null} />
    </Svg>
  );
}

/* ───────────────────────── péndulo */

export function Pendulum({ L, compact }: DProps) {
  const { defs, url } = useMarkers();
  const px = 150, py = 24, len = 140, ang = (25 * Math.PI) / 180;
  const bx = px + len * Math.sin(ang), by = py + len * Math.cos(ang);
  return (
    <Svg compact={compact}>
      {defs}
      <line x1="100" y1={py} x2="200" y2={py} className="wall-line" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <line key={i} x1={104 + i * 11} y1={py} x2={96 + i * 11} y2={py - 8} className="wall-line thin" />
      ))}
      <line x1={px} y1={py} x2={px} y2={py + len + 12} className="center" />
      <path d={`M${px - len * Math.sin(ang)} ${by} A${len} ${len} 0 0 0 ${bx} ${by}`} className="trajectory" />
      <line x1={px} y1={py} x2={bx} y2={by} className="string" />
      <circle cx={bx} cy={by} r="12" className="solid" />
      <Txt x={bx + 18} y={by + 6} s={L("mass")} anchor="start" />
      <Txt x={px + 0.55 * len * Math.sin(ang) + 10} y={py + 0.55 * len * Math.cos(ang)} s={L("char_length")} anchor="start" />
      <path d={`M${px} ${py + 40} A40 40 0 0 0 ${px + 40 * Math.sin(ang)} ${py + 40 * Math.cos(ang)}`} className="dim" />
      <Txt x={px + 10} y={py + 58} s={L("dimensionless")} anchor="start" />
      {L("gravity") && (
        <>
          <line x1="270" y1="80" x2="270" y2="130" className="arrow-line" markerEnd={url("arrow")} />
          <Txt x={278} y={110} s={L("gravity")} anchor="start" />
        </>
      )}
      <Txt x={40} y={110} s={L("time") ? `${L("time")}: periodo` : null} anchor="start" />
    </Svg>
  );
}

/* ───────────────────────── selector por plantilla */

export function ProcessDiagram({ templateId, L, compact }: { templateId?: string; L: Labels; compact?: boolean }) {
  switch (templateId) {
    case "agitated-power":
      return <StirredTank L={L} compact={compact} />;
    case "aerated-power":
    case "bioreactor-kla":
      return <StirredTank L={L} compact={compact} aerated />;
    case "mixing-time":
      return <StirredTank L={L} compact={compact} tracer />;
    case "pipe-flow":
      return <Pipe L={L} compact={compact} mode="friction" />;
    case "forced-convection":
      return <Pipe L={L} compact={compact} mode="heat" />;
    case "convective-mass":
      return <Pipe L={L} compact={compact} mode="mass" />;
    case "centrifugal-pump":
      return <Pump L={L} compact={compact} />;
    case "sphere-drag":
      return <SphereDrag L={L} compact={compact} />;
    case "settling":
      return <Column L={L} compact={compact} />;
    case "bubble-rise":
      return <Column L={L} compact={compact} bubble />;
    case "natural-convection":
      return <Plate L={L} compact={compact} />;
    case "transient-conduction":
      return <Slab L={L} compact={compact} />;
    case "bubble-column-kla":
      return <BubbleColumn L={L} compact={compact} />;
    case "tubular-reactor":
      return <Reactor L={L} compact={compact} />;
    case "pendulum":
      return <Pendulum L={L} compact={compact} />;
    default:
      return null;
  }
}

/** Construye la función de etiquetas a partir de pares (tipo, símbolo). */
export function labelsFrom(pairs: { kindId?: string; symbol: string }[]): Labels {
  const map = new Map<string, string>();
  for (const p of pairs) if (p.kindId && !map.has(p.kindId)) map.set(p.kindId, p.symbol);
  return (k) => map.get(k) ?? null;
}
