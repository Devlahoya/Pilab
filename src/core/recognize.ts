/**
 * Reconocimiento de números adimensionales con nombre y construcción de la
 * relación final  Π_interés = f(Π₁, Π₂, …).
 *
 * Cualquier conjunto de k grupos independientes es una base válida del
 * análisis. Aquí se prefiere una base formada por números conocidos (Re, Po,
 * Nu…), relaciones geométricas (D_t/D) y, sólo si hace falta, grupos del
 * método de variables repetidas.
 */
import { AnalysisResult, Variable, isGroupDimensionless } from "./buckingham";
import { dimEquals, isDimensionless } from "./dimensions";
import { Fraction } from "./fraction";
import { vectorsRank } from "./linalg";
import { KIND_BY_ID, QuantityKind } from "./quantities";
import { NUMBERS } from "./numbers";
import { superscript } from "./dimensions";

export interface ProcessVariable extends Variable {
  kindId?: string;
  /** Valor en unidades SI (opcional). */
  valueSI?: number | null;
}

export type GroupSource = "biblioteca" | "relación" | "adimensional" | "clásico";

export interface NamedGroup {
  key: string;
  source: GroupSource;
  numberId?: string;
  symbol: string;
  name: string;
  exponents: Fraction[];
  /** Variables sustituidas en la definición genérica (p. ej. qué longitud se usó en Re). */
  variant?: string;
  /** Primera (mejor) forma de un número de la biblioteca. */
  primary?: boolean;
  /** Orden de las variables al mostrar la fórmula (como en la definición). */
  termOrder?: number[];
  order: number;
}

/** Tipo efectivo: sólo si las unidades de la variable concuerdan con el tipo. */
export function effectiveKind(v: ProcessVariable): QuantityKind | undefined {
  const k = v.kindId ? KIND_BY_ID[v.kindId] : undefined;
  return k && dimEquals(k.dims, v.dims) ? k : undefined;
}

const vecKey = (exps: Fraction[]) => exps.map((e) => e.toString()).join(",");

function* product<T>(lists: T[][], limit: number): Generator<T[]> {
  const idx = lists.map(() => 0);
  let count = 0;
  if (lists.some((l) => l.length === 0)) return;
  for (;;) {
    yield idx.map((i, k) => lists[k][i]);
    if (++count >= limit) return;
    let p = lists.length - 1;
    while (p >= 0) {
      idx[p]++;
      if (idx[p] < lists[p].length) break;
      idx[p] = 0;
      p--;
    }
    if (p < 0) return;
  }
}

/** Busca todos los números de la biblioteca que se pueden formar con las variables. */
export function matchKnownNumbers(vars: ProcessVariable[]): NamedGroup[] {
  const kinds = vars.map(effectiveKind);
  const candidatesFor = (key: string) =>
    kinds
      .map((k, i) => {
        if (!k) return null;
        if (k.id === key) return { i, rank: 0, viaFamily: false };
        if (k.family === key) return { i, rank: 1 + (k.charScore ?? 5) / 10, viaFamily: true };
        return null;
      })
      .filter((x): x is { i: number; rank: number; viaFamily: boolean } => x !== null)
      .sort((a, b) => a.rank - b.rank || a.i - b.i)
      .map((c, pos) => ({ ...c, score: c.rank + pos * 0.01 }));

  const out: NamedGroup[] = [];
  const seen = new Set<string>();
  NUMBERS.forEach((num, numIdx) => {
    const found: { exps: Fraction[]; score: number; variant: string; termOrder: number[] }[] = [];
    num.definitions.forEach((def, defIdx) => {
      const terms = Object.entries(def);
      const lists = terms.map(([key]) => candidatesFor(key));
      for (const combo of product(lists, 40)) {
        const used = new Set(combo.map((c) => c.i));
        if (used.size !== combo.length) continue; // una variable no puede ocupar dos lugares
        const exps = vars.map(() => Fraction.ZERO);
        combo.forEach((c, t) => (exps[c.i] = Fraction.from(terms[t][1])));
        if (!isGroupDimensionless(vars, exps)) continue;
        const score = combo.reduce((s, c) => s + c.score, 0) + defIdx * 0.5;
        const variant = combo.filter((c) => c.viaFamily).map((c) => vars[c.i].symbol).join(", ");
        found.push({ exps, score, variant, termOrder: combo.map((c) => c.i) });
      }
    });
    found.sort((a, b) => a.score - b.score);
    const kept = found.filter((f) => {
      const key = vecKey(f.exps);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    kept.forEach((f, j) => {
      out.push({
        key: `${num.id}#${vecKey(f.exps)}`,
        source: "biblioteca",
        numberId: num.id,
        symbol: num.symbol,
        name: num.name,
        exponents: f.exps,
        variant: kept.length > 1 ? f.variant : undefined,
        primary: j === 0,
        termOrder: f.termOrder,
        // Las variantes secundarias (p. ej. Re con otra longitud) equivalen a
        // "número × relación geométrica": se prefieren después de las relaciones.
        order: (j === 0 ? numIdx * 10 : 2000 + numIdx * 10 + j) + f.score / 100,
      });
    });
  });
  return out;
}

/** Cocientes entre variables con las mismas dimensiones (relaciones geométricas, Δρ/ρ, etc.). */
export function ratioGroups(vars: ProcessVariable[]): NamedGroup[] {
  const out: NamedGroup[] = [];
  const weight = (v: ProcessVariable) => {
    const k = effectiveKind(v);
    return k ? (k.charScore ?? k.repeatPriority) : 50;
  };
  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const a = vars[i], b = vars[j];
      if (isDimensionless(a.dims) || !dimEquals(a.dims, b.dims)) continue;
      // numerador: la menos "característica"
      const [num, den] = weight(a) > weight(b) || (weight(a) === weight(b) && i > j) ? [i, j] : [j, i];
      const exps = vars.map(() => Fraction.ZERO);
      exps[num] = Fraction.ONE;
      exps[den] = new Fraction(-1);
      out.push({
        key: `ratio#${vecKey(exps)}`,
        source: "relación",
        symbol: `${vars[num].symbol}/${vars[den].symbol}`,
        name: `Relación ${vars[num].name.toLowerCase()} / ${vars[den].name.toLowerCase()}`,
        exponents: exps,
        order: 1000 + out.length,
      });
    }
  }
  return out;
}

function dimensionlessVariableGroups(vars: ProcessVariable[]): NamedGroup[] {
  return vars
    .map((v, i) => ({ v, i }))
    .filter(({ v }) => isDimensionless(v.dims))
    .map(({ v, i }) => {
      const exps = vars.map((_, j) => (j === i ? Fraction.ONE : Fraction.ZERO));
      return { key: `var#${v.id}`, source: "adimensional" as const, symbol: v.symbol, name: v.name, exponents: exps, order: -1 };
    });
}

export const SUBSCRIPT_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"];
export const piLabel = (i: number) => "Π" + String(i).split("").map((d) => SUBSCRIPT_DIGITS[+d]).join("");

export function classicGroups(vars: ProcessVariable[], analysis: AnalysisResult): NamedGroup[] {
  return analysis.groups.map((g, i) => ({
    key: `pi#${vecKey(g.exponents)}`,
    source: "clásico",
    symbol: piLabel(i + 1),
    name: `Grupo de ${vars.find((v) => v.id === g.sourceId)?.symbol ?? "?"}`,
    exponents: g.exponents,
    order: 5000 + i,
  }));
}

export interface Relation {
  dependent?: NamedGroup;
  independents: NamedGroup[];
  /** Todos los números conocidos que se pueden formar con las variables. */
  available: NamedGroup[];
  complete: boolean;
}

export interface RelationOptions {
  dependentId?: string;
  /** Claves que el usuario fijó manualmente (tienen prioridad). */
  pinned?: string[];
  /** Símbolos o ids preferidos (p. ej. definidos por una plantilla de proceso). */
  preferred?: string[];
}

export function buildRelation(vars: ProcessVariable[], analysis: AnalysisResult, opts: RelationOptions = {}): Relation {
  const k = analysis.k;
  const known = [...dimensionlessVariableGroups(vars), ...matchKnownNumbers(vars), ...ratioGroups(vars)];
  const classic = classicGroups(vars, analysis);
  const pinned = opts.pinned ?? [];
  const preferred = opts.preferred ?? [];

  const prefIndex = (g: NamedGroup) => {
    if (g.source === "biblioteca" && !g.primary) return Infinity;
    const i = preferred.findIndex((p) => p === g.numberId || p === g.symbol);
    return i === -1 ? Infinity : i;
  };
  const rankKey = (g: NamedGroup) => {
    const p = pinned.indexOf(g.key);
    return [p === -1 ? Infinity : p, prefIndex(g), g.order];
  };
  const sorted = [...known].sort((a, b) => {
    const ka = rankKey(a), kb = rankKey(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] < kb[i] ? -1 : 1;
    return 0;
  });

  if (k <= 0) return { independents: [], available: known, complete: false };

  const basis: NamedGroup[] = [];
  const tryAdd = (g: NamedGroup) => {
    if (basis.length >= k) return false;
    const r0 = vectorsRank(basis.map((b) => b.exponents));
    const r1 = vectorsRank([...basis.map((b) => b.exponents), g.exponents]);
    if (r1 > r0) {
      basis.push(g);
      return true;
    }
    return false;
  };

  const depIdx = opts.dependentId ? vars.findIndex((v) => v.id === opts.dependentId) : -1;
  const hasDep = (g: NamedGroup) => depIdx >= 0 && !g.exponents[depIdx].isZero();
  let dependent: NamedGroup | undefined;

  if (depIdx >= 0 && !analysis.isolatedIds.includes(opts.dependentId!)) {
    dependent = sorted.find(hasDep) ?? classic.find((c) => analysis.groups.find((g) => vecKey(g.exponents) === vecKey(c.exponents))?.sourceId === opts.dependentId) ?? classic.find(hasDep);
    if (dependent) basis.push(dependent);
  }

  for (const g of sorted) if (!hasDep(g)) tryAdd(g);
  for (const g of classic) if (!hasDep(g)) tryAdd(g);
  for (const g of classic) tryAdd(g);

  // Renumera los grupos clásicos usados para que queden Π₁, Π₂, ...
  let piCount = 0;
  const relabel = (g: NamedGroup): NamedGroup => (g.source === "clásico" ? { ...g, symbol: piLabel(++piCount) } : g);
  const dep = dependent ? relabel(dependent) : undefined;
  const independents = basis.filter((g) => g !== dependent).map(relabel);

  return { dependent: dep, independents, available: known, complete: basis.length === k };
}

/** Valor numérico de un grupo si todas sus variables tienen valor. */
export function evaluateGroup(vars: ProcessVariable[], exps: Fraction[]): number | null {
  let v = 1;
  for (let i = 0; i < vars.length; i++) {
    const e = exps[i];
    if (e.isZero()) continue;
    const x = vars[i].valueSI;
    if (x === undefined || x === null || !Number.isFinite(x)) return null;
    v *= Math.pow(x, e.toNumber());
  }
  return Number.isFinite(v) ? v : null;
}

export interface FactorTerm {
  symbol: string;
  exp: Fraction; // siempre positivo
}

export function splitFraction(
  vars: ProcessVariable[],
  exps: Fraction[],
  termOrder?: number[],
): { num: FactorTerm[]; den: FactorTerm[] } {
  const num: FactorTerm[] = [];
  const den: FactorTerm[] = [];
  const order = termOrder ? [...termOrder, ...exps.map((_, i) => i).filter((i) => !termOrder.includes(i))] : exps.map((_, i) => i);
  for (const i of order) {
    const e = exps[i];
    if (e.isZero()) continue;
    (e.sign() > 0 ? num : den).push({ symbol: vars[i].symbol, exp: e.abs() });
  }
  return { num, den };
}

/** Texto plano, p. ej. "ρ·N·D²/μ". */
export function groupToText(vars: ProcessVariable[], exps: Fraction[], termOrder?: number[]): string {
  const { num, den } = splitFraction(vars, exps, termOrder);
  const t = (terms: FactorTerm[]) =>
    terms.map((f) => (f.exp.equals(Fraction.ONE) ? f.symbol : f.symbol + superscript(f.exp.toString()))).join("·");
  const n = num.length ? t(num) : "1";
  if (!den.length) return n;
  return `${n}/${den.length > 1 ? `(${t(den)})` : t(den)}`;
}

/** LaTeX, p. ej. "\\frac{\\rho N D^{2}}{\\mu}". */
export function groupToLatex(vars: ProcessVariable[], exps: Fraction[], termOrder?: number[]): string {
  const { num, den } = splitFraction(vars, exps, termOrder);
  const greek: Record<string, string> = {
    ρ: "\\rho", μ: "\\mu", ν: "\\nu", σ: "\\sigma", α: "\\alpha", β: "\\beta", δ: "\\delta",
    ε: "\\varepsilon", θ: "\\theta", τ: "\\tau", Δ: "\\Delta ", ψ: "\\psi", φ: "\\phi",
  };
  const sym = (s: string) => {
    const [base, sub] = s.split("_");
    const b = [...base].map((c) => greek[c] ?? c).join("");
    return sub ? `${b}_{${[...sub].map((c) => greek[c] ?? c).join("")}}` : b;
  };
  const t = (terms: FactorTerm[]) =>
    terms.map((f) => (f.exp.equals(Fraction.ONE) ? sym(f.symbol) : `${sym(f.symbol)}^{${f.exp.toString()}}`)).join(" ");
  const n = num.length ? t(num) : "1";
  return den.length ? `\\frac{${n}}{${t(den)}}` : n;
}
