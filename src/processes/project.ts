/**
 * Modelo de un "proyecto" de análisis: lo que el usuario edita en pantalla.
 * Convierte las filas de la tabla (texto) en variables físicas para el motor.
 */
import { KIND_BY_ID, ProcessVariable, ScaleRule, parseUnit, toSI } from "../core";
import { ProcessTemplate, SCALE_DEFAULTS } from "./templates";

export interface VariableRow {
  id: string;
  kindId?: string;
  symbol: string;
  name: string;
  unit: string;
  /** Texto tal como lo escribe el usuario (permite "1e-3", "0,5"). */
  value: string;
}

export interface ScaleState {
  /** Factor geométrico λ = L_planta / L_modelo. */
  lambda: number;
  /** Regla por variable (id de fila); si falta se usa la regla por omisión. */
  rules: Record<string, ScaleRule>;
  /** Valor en planta (texto, mismas unidades) de variables con regla "fijo". */
  fixed: Record<string, string>;
  /** Criterios marcados: id de número, "sym:<símbolo>", "preset:<id>" o clave de grupo. */
  criteria: string[];
}

export interface DataState {
  /** Cada experimento: valor (texto) por id de variable; vacío = se usa el valor de la tabla. */
  rows: Record<string, string>[];
  /** Grupos excluidos del ajuste (referencias de grupo). */
  exclude: string[];
  /** Exponentes impuestos (texto) por referencia de grupo. */
  fixed: Record<string, string>;
  /** Origen de los datos (texto informativo). */
  source?: string;
}

export interface Project {
  title: string;
  templateId?: string;
  rows: VariableRow[];
  dependentId?: string;
  /** Variables repetidas elegidas a mano (vacío = automático). */
  repeatingIds: string[];
  /** Grupos fijados por el usuario en la relación final. */
  pinned: string[];
  preferred?: string[];
  /** Estado del escalamiento; si falta, se usa similitud completa. */
  scale?: ScaleState;
  /** Datos experimentales para ajustar la correlación. */
  data?: DataState;
  /** Id del documento en la nube (si se guardó ahí y es del usuario actual). */
  cloudId?: string;
}

let counter = 0;
export const newId = () => `v${Date.now().toString(36)}${(counter++).toString(36)}`;

export function rowFromKind(kindId: string, overrides: Partial<VariableRow> = {}): VariableRow {
  const k = KIND_BY_ID[kindId];
  return {
    id: newId(),
    kindId,
    symbol: k?.symbol ?? "x",
    name: k?.name ?? "Variable",
    unit: k?.unit ?? "1",
    value: k?.defaultValue !== undefined ? String(k.defaultValue) : "",
    ...overrides,
  };
}

export function projectFromTemplate(t: ProcessTemplate): Project {
  const rows = t.variables.map((v) =>
    rowFromKind(v.kind, {
      ...(v.symbol ? { symbol: v.symbol } : {}),
      ...(v.name ? { name: v.name } : {}),
      ...(v.unit ? { unit: v.unit } : {}),
      ...(v.value !== undefined ? { value: String(v.value) } : {}),
    }),
  );
  const sd = SCALE_DEFAULTS[t.id];
  const rules: Record<string, ScaleRule> = {};
  if (sd?.rules) for (const r of rows) if (r.kindId && sd.rules[r.kindId]) rules[r.id] = sd.rules[r.kindId];
  return {
    title: t.name,
    templateId: t.id,
    rows,
    dependentId: rows[t.dependent]?.id,
    repeatingIds: [],
    pinned: [],
    preferred: t.preferred,
    scale: sd ? { lambda: sd.lambda ?? 10, rules, fixed: {}, criteria: sd.criteria } : undefined,
  };
}

export function emptyProject(): Project {
  return { title: "Análisis nuevo", rows: [], repeatingIds: [], pinned: [] };
}

export function parseValue(text: string): number | null {
  const t = text.trim().replace(",", ".").replace(/\s/g, "").replace(/×10\^?/i, "e");
  if (!t) return null;
  const x = Number(t);
  return Number.isFinite(x) ? x : null;
}

export interface BuiltVariables {
  vars: ProcessVariable[];
  unitErrors: Record<string, string>;
}

export function buildVariables(rows: VariableRow[]): BuiltVariables {
  const vars: ProcessVariable[] = [];
  const unitErrors: Record<string, string> = {};
  for (const r of rows) {
    try {
      const u = parseUnit(r.unit);
      const val = parseValue(r.value);
      const k = r.kindId ? KIND_BY_ID[r.kindId] : undefined;
      vars.push({
        id: r.id,
        symbol: r.symbol.trim() || "?",
        name: r.name.trim() || "Variable",
        dims: u.dims,
        kindId: r.kindId,
        repeatPriority: k?.repeatPriority,
        valueSI: val === null ? null : toSI(val, u),
      });
    } catch (e) {
      unitErrors[r.id] = e instanceof Error ? e.message : "Unidad inválida";
    }
  }
  return { vars, unitErrors };
}
