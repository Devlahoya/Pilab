/**
 * Similitud y escalamiento (modelo → prototipo).
 *
 * Cada variable cambia por un factor s = valor_prototipo / valor_modelo.
 * Mantener constante un grupo Π = Π xᵢ^eᵢ equivale a  Σ eᵢ·ln sᵢ = 0,
 * es decir, una ecuación LINEAL en los logaritmos de los factores.
 *
 * El usuario fija algunos factores (geometría ×λ, mismo fluido ×1, valores
 * conocidos) y elige qué grupos o criterios mantener; el resto se resuelve.
 * Según el rango del sistema el resultado es:
 *   - "ok":           solución única,
 *   - "incompleto":   faltan criterios (hay variables sin determinar),
 *   - "incompatible": los criterios chocan entre sí (similitud imposible).
 */
import { isDimensionless } from "./dimensions";
import { Fraction } from "./fraction";
import { KIND_BY_ID } from "./quantities";
import { ProcessVariable, effectiveKind } from "./recognize";

export type ScaleRule = "igual" | "geometria" | "fijo" | "calcular";

export const SCALE_RULE_LABEL: Record<ScaleRule, string> = {
  igual: "No cambia",
  geometria: "Escala geométrica",
  fijo: "Valor fijo",
  calcular: "Calcular",
};

export interface Criterion {
  key: string;
  exponents: (number | Fraction)[];
}

export interface ScaleInput {
  vars: ProcessVariable[];
  rules: Record<string, ScaleRule>;
  /** Factor geométrico λ = L_prototipo / L_modelo. */
  lambda: number;
  /** Factores para las variables con regla "fijo". */
  fixedFactors: Record<string, number | null>;
  criteria: Criterion[];
}

export type ScaleStatus = "ok" | "incompleto" | "incompatible" | "invalido";

export interface ScaleResult {
  status: ScaleStatus;
  /** Factor prototipo/modelo de cada variable (null si no se pudo determinar). */
  factors: Record<string, number | null>;
  undeterminedIds: string[];
  /** Criterios en conflicto: quitar cualquiera de ellos hace compatible el sistema. */
  conflictKeys: string[];
  /** Criterios que no aportan nada (ya se cumplen o repiten a otros). */
  redundantKeys: string[];
  /** Criterios adicionales necesarios para determinar todo. */
  missing: number;
  message?: string;
}

const num = (x: number | Fraction) => (typeof x === "number" ? x : x.toNumber());

/** Exponente geométrico de una variable con dimensiones de longitud pura (L¹, L², L³…). */
export function geometricPower(v: ProcessVariable): number | null {
  if (isDimensionless(v.dims)) return null;
  const onlyL = v.dims.every((x, i) => i === 1 || Math.abs(x) < 1e-9);
  if (!onlyL) return null;
  const k = effectiveKind(v);
  if (k?.id === "head") return null; // la carga de una bomba es energía, no geometría
  return v.dims[1];
}

/** Regla por omisión: geometría ×λ, propiedades del fluido sin cambio, el resto se calcula. */
export function defaultRule(v: ProcessVariable): ScaleRule {
  if (geometricPower(v) !== null) return "geometria";
  const k = effectiveKind(v);
  if (!k) return "calcular";
  if (k.category === "Propiedades del fluido") return "igual";
  if (["gravity", "temperature", "temperature_difference", "concentration", "pressure", "growth_rate", "reaction_rate_constant"].includes(k.id)) return "igual";
  return "calcular";
}

const TOL = 1e-9;

interface Solved {
  compatible: boolean;
  /** Valor de ln s para cada incógnita (null si queda libre). */
  values: (number | null)[];
  rank: number;
  pivotRows: number[]; // fila original de cada pivote (para detectar redundancia)
}

function solveLinear(A: number[][], b: number[], nUnknowns: number): Solved {
  const m = A.map((row, i) => [...row, b[i]]);
  const rows = m.length;
  const pivots: number[] = [];
  const order = m.map((_, i) => i);
  let r = 0;
  for (let c = 0; c < nUnknowns && r < rows; c++) {
    let best = r;
    for (let i = r + 1; i < rows; i++) if (Math.abs(m[i][c]) > Math.abs(m[best][c])) best = i;
    if (Math.abs(m[best][c]) < TOL) continue;
    [m[r], m[best]] = [m[best], m[r]];
    [order[r], order[best]] = [order[best], order[r]];
    const pv = m[r][c];
    for (let j = 0; j <= nUnknowns; j++) m[r][j] /= pv;
    for (let i = 0; i < rows; i++) {
      if (i === r || Math.abs(m[i][c]) < TOL) continue;
      const f = m[i][c];
      for (let j = 0; j <= nUnknowns; j++) m[i][j] -= f * m[r][j];
    }
    pivots.push(c);
    r++;
  }
  let compatible = true;
  for (let i = r; i < rows; i++) if (Math.abs(m[i][nUnknowns]) > 1e-7) compatible = false;

  const free = new Set([...Array(nUnknowns).keys()].filter((c) => !pivots.includes(c)));
  const values: (number | null)[] = Array(nUnknowns).fill(null);
  pivots.forEach((pc, row) => {
    const dependsOnFree = [...free].some((fc) => Math.abs(m[row][fc]) > TOL);
    values[pc] = dependsOnFree ? null : m[row][nUnknowns];
  });
  return { compatible, values, rank: r, pivotRows: order.slice(0, r) };
}

export function solveScaling(input: ScaleInput): ScaleResult {
  const { vars, rules, lambda, fixedFactors, criteria } = input;
  const factors: Record<string, number | null> = {};

  if (!(lambda > 0) || !Number.isFinite(lambda)) {
    return { status: "invalido", factors, undeterminedIds: [], conflictKeys: [], redundantKeys: [], missing: 0, message: "El factor de escala λ debe ser un número positivo." };
  }

  // Logaritmos conocidos
  const known: (number | null)[] = vars.map((v) => {
    const rule = rules[v.id] ?? defaultRule(v);
    if (rule === "igual") return 0;
    if (rule === "geometria") {
      const p = geometricPower(v);
      return p === null ? 0 : p * Math.log(lambda);
    }
    if (rule === "fijo") {
      const f = fixedFactors[v.id];
      return f !== null && f !== undefined && f > 0 ? Math.log(f) : NaN;
    }
    return null; // calcular
  });

  const badFixed = vars.filter((_, i) => Number.isNaN(known[i]));
  if (badFixed.length) {
    return {
      status: "invalido", factors, undeterminedIds: [], conflictKeys: [], redundantKeys: [], missing: 0,
      message: `Escribe el valor en planta de: ${badFixed.map((v) => v.symbol).join(", ")}.`,
    };
  }

  const unknownIdx = vars.map((_, i) => i).filter((i) => known[i] === null);

  const buildSystem = (crit: Criterion[]) => {
    const A = crit.map((c) => unknownIdx.map((i) => num(c.exponents[i] ?? 0)));
    const b = crit.map((c) => -vars.reduce((s, _, i) => (known[i] === null ? s : s + num(c.exponents[i] ?? 0) * (known[i] as number)), 0));
    return { A, b };
  };

  const { A, b } = buildSystem(criteria);
  const sol = solveLinear(A, b, unknownIdx.length);

  vars.forEach((v, i) => {
    if (known[i] !== null) factors[v.id] = Math.exp(known[i] as number);
  });

  if (!sol.compatible) {
    const conflictKeys = criteria
      .filter((_, j) => {
        const rest = criteria.filter((__, k) => k !== j);
        const s = buildSystem(rest);
        return solveLinear(s.A, s.b, unknownIdx.length).compatible;
      })
      .map((c) => c.key);
    unknownIdx.forEach((i) => (factors[vars[i].id] = null));
    return {
      status: "incompatible",
      factors,
      undeterminedIds: unknownIdx.map((i) => vars[i].id),
      conflictKeys,
      redundantKeys: [],
      missing: 0,
    };
  }

  unknownIdx.forEach((i, u) => {
    const val = sol.values[u];
    factors[vars[i].id] = val === null ? null : Math.exp(val);
  });
  const undeterminedIds = unknownIdx.filter((_, u) => sol.values[u] === null).map((i) => vars[i].id);
  const redundantKeys = criteria.filter((_, j) => !sol.pivotRows.includes(j)).map((c) => c.key);

  return {
    status: undeterminedIds.length ? "incompleto" : "ok",
    factors,
    undeterminedIds,
    conflictKeys: [],
    redundantKeys,
    missing: unknownIdx.length - sol.rank,
  };
}

/** Razón prototipo/modelo de un grupo, si todos sus factores se conocen. */
export function groupRatio(vars: ProcessVariable[], exps: (number | Fraction)[], factors: Record<string, number | null>): number | null {
  let lg = 0;
  for (let i = 0; i < vars.length; i++) {
    const e = num(exps[i] ?? 0);
    if (e === 0) continue;
    const f = factors[vars[i].id];
    if (f === null || f === undefined) return null;
    lg += e * Math.log(f);
  }
  return Math.exp(lg);
}

/* ───────────────────────── criterios de ingeniería (no adimensionales) */

export interface ScalePreset {
  id: string;
  label: string;
  short: string;
  note: string;
  definitions: Record<string, number>[];
}

export const SCALE_PRESETS: ScalePreset[] = [
  {
    id: "PV", label: "Potencia por volumen (P/V) constante", short: "P/V",
    note: "El criterio más usado para escalar tanques agitados y biorreactores. Con similitud geométrica V ∝ D³.",
    definitions: [{ power: 1, volume: -1 }, { power: 1, tank_diameter: -3 }, { power: 1, impeller_diameter: -3 }],
  },
  {
    id: "tip", label: "Velocidad de punta (π·N·D) constante", short: "N·D",
    note: "Mantiene el esfuerzo de corte máximo en el impulsor; importante con células sensibles o micelios.",
    definitions: [{ rotational_speed: 1, impeller_diameter: 1 }],
  },
  {
    id: "N", label: "Misma velocidad de agitación", short: "N",
    note: "Conserva el tiempo de circulación (y de mezclado en régimen turbulento), pero dispara la potencia.",
    definitions: [{ rotational_speed: 1 }],
  },
  {
    id: "vvm", label: "Misma aireación en vvm (Q_g/V)", short: "vvm",
    note: "Volúmenes de gas por volumen de líquido por minuto.",
    definitions: [{ gas_flow: 1, volume: -1 }, { gas_flow: 1, tank_diameter: -3 }, { gas_flow: 1, impeller_diameter: -3 }],
  },
  {
    id: "vs", label: "Misma velocidad superficial del gas", short: "v_s",
    note: "Q_g dividido entre el área transversal del tanque o columna.",
    definitions: [{ superficial_gas_velocity: 1 }, { gas_flow: 1, tank_diameter: -2 }],
  },
  {
    id: "kla", label: "Mismo kLa", short: "kLa",
    note: "Asegura la misma capacidad de transferencia de oxígeno.",
    definitions: [{ kla: 1 }],
  },
  {
    id: "v", label: "Misma velocidad del fluido", short: "v",
    note: "Común en tuberías y lechos: conserva el tiempo de contacto por unidad de longitud.",
    definitions: [{ velocity: 1 }],
  },
  {
    id: "h", label: "Mismo coeficiente de transferencia de calor", short: "h",
    note: "Útil cuando la transferencia de calor limita el proceso.",
    definitions: [{ heat_transfer_coeff: 1 }],
  },
];

/** Convierte un preset en exponentes sobre las variables actuales (o null si faltan variables). */
export function presetExponents(vars: ProcessVariable[], preset: ScalePreset): number[] | null {
  const kinds = vars.map(effectiveKind);
  for (const def of preset.definitions) {
    const exps = vars.map(() => 0);
    let ok = true;
    for (const [key, e] of Object.entries(def)) {
      let idx = kinds.findIndex((k) => k?.id === key);
      if (idx === -1) idx = kinds.findIndex((k) => k?.family === key && KIND_BY_ID[key] === undefined);
      if (idx === -1) { ok = false; break; }
      exps[idx] = e;
    }
    if (ok) return exps;
  }
  return null;
}
