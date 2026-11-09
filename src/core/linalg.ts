/**
 * Álgebra lineal exacta sobre fracciones: forma escalonada reducida,
 * rango, espacio nulo y solución de sistemas.
 */
import { Fraction, lcm } from "./fraction";

export type Matrix = Fraction[][];

export function toMatrix(rows: readonly (readonly number[])[]): Matrix {
  return rows.map((r) => r.map((x) => Fraction.from(x)));
}

export function cloneMatrix(m: Matrix): Matrix {
  return m.map((r) => r.slice());
}

/** Forma escalonada reducida por filas (RREF). Devuelve la matriz y las columnas pivote. */
export function rref(input: Matrix): { matrix: Matrix; pivots: number[] } {
  const m = cloneMatrix(input);
  const rows = m.length;
  const cols = rows ? m[0].length : 0;
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows; c++) {
    let p = -1;
    for (let i = r; i < rows; i++) {
      if (!m[i][c].isZero()) { p = i; break; }
    }
    if (p === -1) continue;
    [m[r], m[p]] = [m[p], m[r]];
    const pv = m[r][c];
    m[r] = m[r].map((x) => x.div(pv));
    for (let i = 0; i < rows; i++) {
      if (i === r || m[i][c].isZero()) continue;
      const f = m[i][c];
      m[i] = m[i].map((x, j) => x.sub(f.mul(m[r][j])));
    }
    pivots.push(c);
    r++;
  }
  return { matrix: m, pivots };
}

export function rank(m: Matrix): number {
  if (m.length === 0) return 0;
  return rref(m).pivots.length;
}

/** Base del espacio nulo { x : M x = 0 }. Cada vector tiene longitud = columnas de M. */
export function nullspace(m: Matrix, cols?: number): Fraction[][] {
  const n = cols ?? (m[0]?.length ?? 0);
  if (m.length === 0) {
    return Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => (i === j ? Fraction.ONE : Fraction.ZERO)),
    );
  }
  const { matrix, pivots } = rref(m);
  const free = [...Array(n).keys()].filter((c) => !pivots.includes(c));
  return free.map((f) => {
    const v = Array.from({ length: n }, () => Fraction.ZERO);
    v[f] = Fraction.ONE;
    pivots.forEach((pc, row) => {
      v[pc] = matrix[row][f].neg();
    });
    return v;
  });
}

/** Resuelve A x = b. Devuelve null si el sistema es incompatible. Si hay infinitas soluciones, las libres valen 0. */
export function solve(A: Matrix, b: Fraction[]): Fraction[] | null {
  const cols = A[0]?.length ?? 0;
  const aug = A.map((row, i) => [...row, b[i]]);
  const { matrix, pivots } = rref(aug);
  if (pivots.includes(cols)) return null; // fila 0 = c ≠ 0
  const x = Array.from({ length: cols }, () => Fraction.ZERO);
  pivots.forEach((pc, row) => {
    x[pc] = matrix[row][cols];
  });
  return x;
}

/** Escala un vector racional al vector entero más pequeño con la misma dirección. */
export function toIntegerVector(v: Fraction[]): Fraction[] {
  const L = v.reduce((acc, x) => lcm(acc, x.den), 1);
  const ints = v.map((x) => (x.num * L) / x.den);
  let g = 0;
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
  for (const x of ints) g = gcd(g, Math.abs(x));
  return ints.map((x) => new Fraction(g ? x / g : x));
}

/** Rango de un conjunto de vectores (como filas). */
export function vectorsRank(vectors: Fraction[][]): number {
  return vectors.length ? rank(vectors) : 0;
}
