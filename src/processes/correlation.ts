/**
 * Une los datos experimentales con la relación adimensional: calcula cada grupo
 * en cada experimento y ajusta la correlación Π₀ = C·Π₁^a·Π₂^b·…
 */
import {
  FitResult,
  NamedGroup,
  ProcessVariable,
  Relation,
  evaluateGroup,
  fitPowerLaw,
  toSI,
  tryParseUnit,
} from "../core";
import { groupRef } from "../ui/groups";
import { DataState, VariableRow, parseValue } from "./project";

export interface CorrelationEntry {
  g: NamedGroup;
  ref: string;
  values: number[];
}

export interface Correlation {
  dep: NamedGroup;
  depValues: number[];
  entries: CorrelationEntry[];
  fit: FitResult;
  /**
   * Exponentes (sobre las variables) del monomio Π₀ / ∏ Πⱼ^aⱼ, que la
   * correlación mantiene igual a C: sirve como criterio de escalamiento.
   */
  criterion: number[] | null;
}

/** Valores SI de las variables en un experimento (celdas vacías = valor de la tabla). */
export function experimentVariables(vars: ProcessVariable[], varRows: VariableRow[], dataRow: Record<string, string>): ProcessVariable[] {
  return vars.map((v) => {
    const cell = dataRow[v.id];
    const x = cell !== undefined ? parseValue(cell) : null;
    if (x === null) return v;
    const row = varRows.find((r) => r.id === v.id);
    const u = row ? tryParseUnit(row.unit) : null;
    return { ...v, valueSI: u ? toSI(x, u) : x };
  });
}

export function computeCorrelation(
  vars: ProcessVariable[],
  varRows: VariableRow[],
  relation: Relation,
  data?: DataState,
): Correlation | null {
  const dep = relation.dependent;
  if (!dep || !data || data.rows.length === 0) return null;

  const perRow = data.rows.map((r) => experimentVariables(vars, varRows, r));
  const depValues = perRow.map((vs) => evaluateGroup(vs, dep.exponents) ?? NaN);
  const entries: CorrelationEntry[] = relation.independents.map((g) => ({
    g,
    ref: groupRef(g),
    values: perRow.map((vs) => evaluateGroup(vs, g.exponents) ?? NaN),
  }));

  const fit = fitPowerLaw(
    depValues,
    entries.map((e) => ({
      key: e.ref,
      label: e.g.symbol,
      values: e.values,
      excluded: data.exclude.includes(e.ref),
      fixed: parseValue(data.fixed[e.ref] ?? ""),
    })),
  );

  let criterion: number[] | null = null;
  if (fit.ok) {
    criterion = dep.exponents.map((x) => x.toNumber());
    fit.groups.forEach((r, j) => {
      if (r.exponent === null || (r.status !== "ajustado" && r.status !== "fijo")) return;
      entries[j].g.exponents.forEach((e, i) => {
        criterion![i] -= r.exponent! * e.toNumber();
      });
    });
  }

  return { dep, depValues, entries, fit, criterion };
}
