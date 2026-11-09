/**
 * Ajuste de correlaciones adimensionales a datos experimentales.
 *
 * El teorema Π dice la FORMA de la relación, Π₀ = f(Π₁, Π₂, …), pero no la
 * función f: ésta se obtiene de experimentos. La forma más usada es la ley de
 * potencias
 *          Π₀ = C · Π₁^a₁ · Π₂^a₂ · …
 * que al tomar logaritmos queda lineal:
 *          ln Π₀ = ln C + a₁ ln Π₁ + a₂ ln Π₂ + …
 * y se resuelve por mínimos cuadrados.
 *
 * Antes de ajustar se revisa que cada grupo realmente haya variado en los
 * experimentos (si no, su exponente no se puede estimar) y que no varíe junto
 * con otros (colinealidad: p. ej. si sólo se cambió N, Re y Fr cambian a la vez
 * y sus efectos no se pueden separar).
 */

export interface FitGroupInput {
  key: string;
  label: string;
  /** Valores del grupo en cada experimento. */
  values: number[];
  /** Exponente impuesto por el usuario (no se ajusta). */
  fixed?: number | null;
  /** El usuario lo excluyó del ajuste. */
  excluded?: boolean;
}

export type GroupFitStatus = "ajustado" | "fijo" | "excluido" | "constante" | "colineal";

export interface GroupFitResult {
  key: string;
  label: string;
  status: GroupFitStatus;
  exponent: number | null;
  stdError: number | null;
  ci95: number | null;
  /** Para "colineal": con qué grupos varía junto. */
  collinearWith?: string[];
}

export interface FitResult {
  ok: boolean;
  message?: string;
  C: number;
  cCi95: [number, number] | null;
  groups: GroupFitResult[];
  /** Coeficiente de determinación en escala logarítmica. */
  r2: number;
  /** Error relativo medio absoluto (%) en escala original. */
  mape: number;
  maxError: number;
  n: number;
  dof: number;
  /** Filas usadas (índices de la entrada). */
  used: number[];
  dropped: number[];
  observed: number[];
  predicted: number[];
}

/** Cuantil 0.975 de la t de Student. */
export function tQuantile975(dof: number): number {
  const table = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
  if (dof < 1) return NaN;
  if (dof <= 30) return table[dof - 1];
  if (dof <= 60) return 2.042 - ((dof - 30) * (2.042 - 2.0)) / 30;
  if (dof <= 120) return 2.0 - ((dof - 60) * (2.0 - 1.98)) / 60;
  return 1.96;
}

/** Inversa de una matriz simétrica pequeña por Gauss-Jordan; null si es singular. */
function invert(A: number[][]): number[][] | null {
  const n = A.length;
  const m = A.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) return null;
    [m[c], m[p]] = [m[p], m[c]];
    const pv = m[c][c];
    for (let j = 0; j < 2 * n; j++) m[c][j] /= pv;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = m[r][c];
      if (f === 0) continue;
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row) => row.slice(n));
}

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;

export function fitPowerLaw(dependent: number[], groups: FitGroupInput[]): FitResult {
  const nAll = dependent.length;
  const empty: FitResult = {
    ok: false, C: NaN, cCi95: null, groups: [], r2: NaN, mape: NaN, maxError: NaN, n: 0, dof: 0,
    used: [], dropped: [], observed: [], predicted: [],
  };

  // Filas válidas: todos los valores positivos y finitos
  const used: number[] = [];
  const dropped: number[] = [];
  for (let i = 0; i < nAll; i++) {
    const vals = [dependent[i], ...groups.map((g) => g.values[i])];
    if (vals.every((v) => Number.isFinite(v) && v > 0)) used.push(i);
    else dropped.push(i);
  }
  const n = used.length;
  if (n < 2) {
    return { ...empty, used, dropped, message: "Se necesitan al menos 2 experimentos completos (con todos los valores positivos)." };
  }

  const y0 = used.map((i) => Math.log(dependent[i]));
  const logs = groups.map((g) => used.map((i) => Math.log(g.values[i])));

  const results: GroupFitResult[] = groups.map((g) => ({ key: g.key, label: g.label, status: "ajustado", exponent: null, stdError: null, ci95: null }));

  // Exponentes fijos: se pasan al lado izquierdo
  const y = y0.slice();
  groups.forEach((g, j) => {
    if (g.fixed !== null && g.fixed !== undefined && Number.isFinite(g.fixed)) {
      results[j].status = "fijo";
      results[j].exponent = g.fixed;
      for (let k = 0; k < n; k++) y[k] -= g.fixed * logs[j][k];
    } else if (g.excluded) {
      results[j].status = "excluido";
    }
  });

  // Grupos constantes y colineales (Gram-Schmidt sobre columnas centradas)
  const basis: { idx: number; vec: number[] }[] = [];
  groups.forEach((_, j) => {
    if (results[j].status !== "ajustado") return;
    const m = mean(logs[j]);
    const centered = logs[j].map((x) => x - m);
    const norm0 = Math.sqrt(centered.reduce((s, x) => s + x * x, 0));
    if (norm0 < 1e-9 * Math.max(1, Math.abs(m)) || norm0 < 1e-9) {
      results[j].status = "constante";
      return;
    }
    let v = centered.slice();
    const involved: string[] = [];
    for (const b of basis) {
      const proj = v.reduce((s, x, k) => s + x * b.vec[k], 0);
      if (Math.abs(proj) > 1e-9) involved.push(groups[b.idx].label);
      v = v.map((x, k) => x - proj * b.vec[k]);
    }
    const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    if (norm < 1e-6 * norm0) {
      results[j].status = "colineal";
      results[j].collinearWith = involved;
      return;
    }
    basis.push({ idx: j, vec: v.map((x) => x / norm) });
  });

  const fitIdx = groups.map((_, j) => j).filter((j) => results[j].status === "ajustado");
  const p = fitIdx.length + 1; // + ordenada
  if (n < p) {
    return {
      ...empty, used, dropped, groups: results,
      message: `Hay ${fitIdx.length} exponentes por ajustar más la constante C: se necesitan al menos ${p} experimentos y tienes ${n}.`,
    };
  }

  // Mínimos cuadrados: X = [1, ln Π₁, ln Π₂, …]
  const X = Array.from({ length: n }, (_, k) => [1, ...fitIdx.map((j) => logs[j][k])]);
  const XtX = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => X.reduce((s, row) => s + row[a] * row[b], 0)));
  const Xty = Array.from({ length: p }, (_, a) => X.reduce((s, row, k) => s + row[a] * y[k], 0));
  const inv = invert(XtX);
  if (!inv) {
    return { ...empty, used, dropped, groups: results, message: "El sistema es singular: revisa que los grupos hayan variado de forma independiente." };
  }
  const beta = inv.map((row) => row.reduce((s, x, b) => s + x * Xty[b], 0));
  const fitted = X.map((row) => row.reduce((s, x, b) => s + x * beta[b], 0));
  const resid = y.map((v, k) => v - fitted[k]);
  const ssr = resid.reduce((s, r) => s + r * r, 0);
  const ym = mean(y0);
  const predLog = fitted.map((f, k) => f + (y0[k] - y[k])); // devuelve los términos fijos
  const sst = y0.reduce((s, v) => s + (v - ym) ** 2, 0);
  const r2 = sst > 0 ? 1 - ssr / sst : 1;
  const dof = n - p;
  const s2 = dof > 0 ? ssr / dof : NaN;
  const t = tQuantile975(dof);

  fitIdx.forEach((j, b) => {
    results[j].exponent = beta[b + 1];
    const se = dof > 0 ? Math.sqrt(Math.max(0, s2 * inv[b + 1][b + 1])) : null;
    results[j].stdError = se;
    results[j].ci95 = se !== null ? t * se : null;
  });
  const seC = dof > 0 ? Math.sqrt(Math.max(0, s2 * inv[0][0])) : null;

  const observed = used.map((i) => dependent[i]);
  const predicted = predLog.map(Math.exp);
  const rel = observed.map((o, k) => Math.abs(predicted[k] - o) / o);

  return {
    ok: true,
    C: Math.exp(beta[0]),
    cCi95: seC !== null ? [Math.exp(beta[0] - t * seC), Math.exp(beta[0] + t * seC)] : null,
    groups: results,
    r2,
    mape: (100 * rel.reduce((s, x) => s + x, 0)) / n,
    maxError: 100 * Math.max(...rel),
    n,
    dof,
    used,
    dropped,
    observed,
    predicted,
    message: dof === 0 ? "Hay exactamente tantos experimentos como parámetros: el ajuste pasa por todos los puntos y no se puede estimar la incertidumbre." : undefined,
  };
}

/* ───────────────────────── lectura de tablas pegadas o CSV */

export interface ParsedTable {
  header: string[] | null;
  rows: string[][];
  delimiter: string;
}

/** Interpreta texto copiado de Excel/Sheets (tabuladores) o CSV (coma o punto y coma). */
export function parseDelimited(text: string): ParsedTable {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return { header: null, rows: [], delimiter: "," };
  const sampleLines = lines.slice(0, 5);
  // Un delimitador es válido si aparece en todas las líneas de la muestra
  const inAll = (d: string) => sampleLines.every((l) => l.includes(d));
  const delimiter = inAll("\t") ? "\t" : inAll(";") ? ";" : ",";
  const split = (l: string) => l.split(delimiter).map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const cells = lines.map(split);
  const isNum = (s: string) => s !== "" && Number.isFinite(Number(s.replace(",", ".").replace(/\s/g, "")));
  const first = cells[0];
  const hasHeader = first.some((c) => c !== "" && !isNum(c));
  return { header: hasHeader ? first : null, rows: hasHeader ? cells.slice(1) : cells, delimiter };
}

/** Quita unidades entre paréntesis o corchetes: "N (rpm)" → "N". */
export function cleanHeader(h: string): string {
  return h.replace(/[([].*?[)\]]/g, "").trim();
}
