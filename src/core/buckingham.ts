/**
 * Teorema Π de Buckingham.
 *
 * Si un fenómeno depende de n variables y éstas involucran r dimensiones
 * independientes (r = rango de la matriz dimensional), el fenómeno puede
 * describirse con k = n − r grupos adimensionales independientes.
 *
 * Método de variables repetidas:
 *   1. Elegir r variables "repetidas" con dimensiones independientes.
 *   2. Para cada variable no repetida q, buscar exponentes a tales que
 *      Π = q · R₁^a₁ · R₂^a₂ · … sea adimensional  →  D_R · a = −d_q.
 */
import { BASE_DIMENSIONS, DimVector, isDimensionless } from "./dimensions";
import { Fraction } from "./fraction";
import { Matrix, nullspace, rank, solve, toIntegerVector } from "./linalg";

export interface Variable {
  id: string;
  symbol: string;
  name: string;
  dims: DimVector;
  /** Menor = más conveniente como variable repetida (longitud, velocidad, densidad...). */
  repeatPriority?: number;
}

export interface PiGroup {
  /** Exponentes enteros sobre las variables (mismo orden que la entrada). */
  exponents: Fraction[];
  /** Variable no repetida que "genera" el grupo (método de variables repetidas). */
  sourceId?: string;
  /** Exponentes de las repetidas antes de convertir a enteros (para mostrar el procedimiento). */
  rawExponents?: Fraction[];
}

export interface AnalysisInput {
  variables: Variable[];
  dependentId?: string;
  /** Si no se indica, se eligen automáticamente. */
  repeatingIds?: string[];
}

export interface AnalysisWarning {
  level: "error" | "aviso";
  message: string;
}

export interface AnalysisResult {
  n: number;
  rank: number;
  k: number;
  /** Índices de las dimensiones base que aparecen. */
  activeDims: number[];
  /** Matriz dimensional: filas = dimensiones activas, columnas = variables. */
  matrix: number[][];
  repeatingIds: string[];
  repeatingAuto: boolean;
  repeatingValid: boolean;
  groups: PiGroup[];
  /** Variables que no pueden aparecer en ningún grupo adimensional. */
  isolatedIds: string[];
  warnings: AnalysisWarning[];
}

export function dimensionalMatrix(variables: Variable[]): { matrix: number[][]; activeDims: number[] } {
  const activeDims = BASE_DIMENSIONS.map((_, i) => i).filter((i) =>
    variables.some((v) => Math.abs(v.dims[i]) > 1e-9),
  );
  const matrix = activeDims.map((d) => variables.map((v) => v.dims[d]));
  return { matrix, activeDims };
}

const asFracMatrix = (m: number[][]): Matrix => m.map((r) => r.map((x) => Fraction.from(x)));

function columnsRank(matrix: Matrix, cols: number[]): number {
  if (matrix.length === 0 || cols.length === 0) return 0;
  return rank(matrix.map((row) => cols.map((c) => row[c])));
}

/** Elige automáticamente r variables repetidas con dimensiones independientes. */
export function chooseRepeating(variables: Variable[], dependentId?: string): string[] {
  const { matrix } = dimensionalMatrix(variables);
  const M = asFracMatrix(matrix);
  const r = M.length ? rank(M) : 0;

  const complexity = (v: Variable) => {
    const nz = v.dims.filter((x) => Math.abs(x) > 1e-9).length;
    const sum = v.dims.reduce((a, x) => a + Math.abs(x), 0);
    return nz * 10 + sum;
  };

  const candidates = variables
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => v.id !== dependentId && !isDimensionless(v.dims))
    .sort((a, b) =>
      (a.v.repeatPriority ?? 50) - (b.v.repeatPriority ?? 50) ||
      complexity(a.v) - complexity(b.v) ||
      a.i - b.i,
    );

  const chosen: number[] = [];
  for (const { i } of candidates) {
    if (chosen.length === r) break;
    if (columnsRank(M, [...chosen, i]) > chosen.length) chosen.push(i);
  }
  // Si no alcanzó (p. ej. sólo la dependiente aporta una dimensión), se permite incluirla.
  if (chosen.length < r) {
    for (let i = 0; i < variables.length && chosen.length < r; i++) {
      if (chosen.includes(i) || isDimensionless(variables[i].dims)) continue;
      if (columnsRank(M, [...chosen, i]) > chosen.length) chosen.push(i);
    }
  }
  return chosen.sort((a, b) => a - b).map((i) => variables[i].id);
}

export function analyze(input: AnalysisInput): AnalysisResult {
  const { variables, dependentId } = input;
  const warnings: AnalysisWarning[] = [];
  const n = variables.length;
  const { matrix, activeDims } = dimensionalMatrix(variables);
  const M = asFracMatrix(matrix);
  const r = M.length ? rank(M) : 0;
  const k = n - r;

  // Símbolos repetidos
  const seen = new Map<string, number>();
  variables.forEach((v) => seen.set(v.symbol, (seen.get(v.symbol) ?? 0) + 1));
  for (const [s, c] of seen) {
    if (c > 1 && s) warnings.push({ level: "aviso", message: `El símbolo "${s}" se usa ${c} veces; conviene distinguirlos (p. ej. D₁, D₂).` });
  }

  // Variables aisladas: su exponente es 0 en todo el espacio nulo
  const ns = nullspace(M, n);
  const isolatedIds = variables
    .filter((_, j) => ns.every((vec) => vec[j].isZero()))
    .map((v) => v.id);

  for (const id of isolatedIds) {
    const v = variables.find((x) => x.id === id)!;
    const uniqueDims = activeDims.filter(
      (d) => Math.abs(v.dims[d]) > 1e-9 && variables.filter((o) => Math.abs(o.dims[d]) > 1e-9).length === 1,
    );
    const extra = uniqueDims.length
      ? ` Es la única variable con la dimensión ${uniqueDims.map((d) => `${BASE_DIMENSIONS[d].key} (${BASE_DIMENSIONS[d].name.toLowerCase()})`).join(", ")}.`
      : "";
    const isDep = id === dependentId;
    warnings.push({
      level: isDep ? "error" : "aviso",
      message: `${v.symbol} (${v.name}) no puede formar parte de ningún grupo adimensional.${extra} ` +
        (isDep
          ? "Como es la variable de interés, el análisis no puede describirla: probablemente falta una variable relevante."
          : "Revisa sus unidades o si falta otra variable que la compense."),
    });
  }

  if (n === 0) {
    return { n, rank: r, k, activeDims, matrix, repeatingIds: [], repeatingAuto: true, repeatingValid: true, groups: [], isolatedIds, warnings };
  }
  if (k <= 0) {
    warnings.push({ level: "error", message: "Con estas variables no se puede formar ningún grupo adimensional (k = n − r = 0). Agrega más variables." });
  }

  // Variables repetidas
  const repeatingAuto = !input.repeatingIds || input.repeatingIds.length === 0;
  let repeatingIds = repeatingAuto ? chooseRepeating(variables, dependentId) : input.repeatingIds!.filter((id) => variables.some((v) => v.id === id));
  const repIdx = repeatingIds.map((id) => variables.findIndex((v) => v.id === id));

  let repeatingValid = true;
  if (repIdx.length !== r) {
    repeatingValid = false;
    warnings.push({ level: "error", message: `Se necesitan exactamente ${r} variables repetidas (una por cada dimensión independiente); hay ${repIdx.length} seleccionadas.` });
  } else if (columnsRank(M, repIdx) < r) {
    repeatingValid = false;
    warnings.push({ level: "error", message: "Las variables repetidas elegidas no tienen dimensiones independientes entre sí (una se puede formar con las otras). Elige otra combinación." });
  }
  if (repeatingValid && dependentId && repeatingIds.includes(dependentId) && !repeatingAuto) {
    warnings.push({ level: "aviso", message: "La variable de interés está entre las repetidas; así aparecerá en varios grupos. Normalmente no se elige como repetida." });
  }

  let groups: PiGroup[] = [];
  if (repeatingValid && k > 0) {
    const R: Matrix = M.map((row) => repIdx.map((c) => row[c]));
    for (let j = 0; j < n; j++) {
      if (repIdx.includes(j)) continue;
      const b = M.map((row) => row[j].neg());
      const a = M.length ? solve(R, b) : [];
      if (!a) continue; // no debería ocurrir si las repetidas son válidas
      const raw = Array.from({ length: n }, () => Fraction.ZERO);
      raw[j] = Fraction.ONE;
      repIdx.forEach((c, i) => (raw[c] = a[i]));
      let ints = toIntegerVector(raw);
      if (ints[j].sign() < 0) ints = ints.map((x) => x.neg());
      groups.push({ exponents: ints, sourceId: variables[j].id, rawExponents: raw });
    }
    // El grupo de la variable de interés va primero
    if (dependentId) {
      groups.sort((g1, g2) => (g2.sourceId === dependentId ? 1 : 0) - (g1.sourceId === dependentId ? 1 : 0));
    }
  } else if (!repeatingValid) {
    repeatingIds = [];
  }

  return { n, rank: r, k, activeDims, matrix, repeatingIds, repeatingAuto, repeatingValid, groups, isolatedIds, warnings };
}

/** Comprueba que un vector de exponentes produce un grupo adimensional. */
export function isGroupDimensionless(variables: Variable[], exponents: (Fraction | number)[]): boolean {
  return BASE_DIMENSIONS.every((_, d) => {
    let s = 0;
    variables.forEach((v, j) => {
      const e = exponents[j];
      s += v.dims[d] * (typeof e === "number" ? e : e.toNumber());
    });
    return Math.abs(s) < 1e-9;
  });
}
