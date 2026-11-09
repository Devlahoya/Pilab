/**
 * Unidades y analizador de expresiones de unidades.
 *
 * Permite que el usuario escriba unidades como las escribe en su cuaderno:
 *   "kg/m3", "Pa·s", "W/(m^2·K)", "J/kg·K", "m³/h", "1/s", "rpm", "cP", "mM"
 * y obtiene su fórmula dimensional y el factor de conversión al SI.
 *
 * Convención de ingeniería: todo lo que sigue a "/" queda en el denominador
 * ("J/kg·K" = J/(kg·K)) hasta el siguiente "/".
 */
import { DIMENSIONLESS, DimVector, dim, dimAdd, dimScale } from "./dimensions";

export interface UnitDef {
  dims: DimVector;
  /** Multiplicador al SI: valor_SI = valor · factor + offset */
  factor: number;
  offset?: number;
  name: string;
  /** Admite prefijos SI (k, m, µ, ...) */
  prefixable?: boolean;
}

const U = (
  name: string,
  dims: DimVector,
  factor = 1,
  opts: { prefixable?: boolean; offset?: number } = {},
): UnitDef => ({ name, dims, factor, ...opts });

const M = dim({ M: 1 });
const L = dim({ L: 1 });
const T = dim({ T: 1 });
const K = dim({ Θ: 1 });
const MOL = dim({ N: 1 });
const FORCE = dim({ M: 1, L: 1, T: -2 });
const PRESSURE = dim({ M: 1, L: -1, T: -2 });
const ENERGY = dim({ M: 1, L: 2, T: -2 });
const POWER = dim({ M: 1, L: 2, T: -3 });
const FREQ = dim({ T: -1 });
const VOLUME = dim({ L: 3 });
const VISC = dim({ M: 1, L: -1, T: -1 });
const KVISC = dim({ L: 2, T: -1 });
const CONC_MOLAR = dim({ N: 1, L: -3 });

export const UNITS: Record<string, UnitDef> = {
  // adimensionales
  "1": U("adimensional", DIMENSIONLESS),
  "-": U("adimensional", DIMENSIONLESS),
  "%": U("por ciento", DIMENSIONLESS, 0.01),
  rad: U("radián", DIMENSIONLESS),
  // masa
  kg: U("kilogramo", M),
  g: U("gramo", M, 1e-3, { prefixable: true }),
  t: U("tonelada", M, 1000),
  lb: U("libra", M, 0.45359237),
  // longitud
  m: U("metro", L, 1, { prefixable: true }),
  in: U("pulgada", L, 0.0254),
  ft: U("pie", L, 0.3048),
  // tiempo
  s: U("segundo", T, 1, { prefixable: true }),
  min: U("minuto", T, 60),
  h: U("hora", T, 3600),
  d: U("día", T, 86400),
  // temperatura
  K: U("kelvin", K, 1, { prefixable: true }),
  "°C": U("grado Celsius", K, 1, { offset: 273.15 }),
  "ºC": U("grado Celsius", K, 1, { offset: 273.15 }),
  C: U("grado Celsius", K, 1, { offset: 273.15 }),
  // cantidad de sustancia
  mol: U("mol", MOL, 1, { prefixable: true }),
  // eléctricas / luminosas
  A: U("ampere", dim({ I: 1 }), 1, { prefixable: true }),
  cd: U("candela", dim({ J: 1 })),
  // derivadas
  N: U("newton", FORCE, 1, { prefixable: true }),
  dyn: U("dina", FORCE, 1e-5),
  Pa: U("pascal", PRESSURE, 1, { prefixable: true }),
  bar: U("bar", PRESSURE, 1e5, { prefixable: true }),
  atm: U("atmósfera", PRESSURE, 101325),
  psi: U("psi", PRESSURE, 6894.757),
  mmHg: U("mmHg", PRESSURE, 133.322),
  J: U("joule", ENERGY, 1, { prefixable: true }),
  cal: U("caloría", ENERGY, 4.184, { prefixable: true }),
  BTU: U("BTU", ENERGY, 1055.06),
  W: U("watt", POWER, 1, { prefixable: true }),
  hp: U("caballo de fuerza", POWER, 745.7),
  Hz: U("hertz", FREQ, 1, { prefixable: true }),
  rpm: U("revoluciones por minuto", FREQ, 1 / 60),
  rps: U("revoluciones por segundo", FREQ, 1),
  vvm: U("vol. de gas / vol. de líquido / min", FREQ, 1 / 60),
  L: U("litro", VOLUME, 1e-3, { prefixable: true }),
  l: U("litro", VOLUME, 1e-3, { prefixable: true }),
  gal: U("galón (EE. UU.)", VOLUME, 3.785411784e-3),
  P: U("poise", VISC, 0.1, { prefixable: true }),
  St: U("stokes", KVISC, 1e-4, { prefixable: true }),
  M: U("molar (mol/L)", CONC_MOLAR, 1000, { prefixable: true }),
};

const PREFIXES: Record<string, number> = {
  G: 1e9, M: 1e6, k: 1e3, h: 1e2, da: 10, d: 1e-1, c: 1e-2, m: 1e-3,
  µ: 1e-6, μ: 1e-6, u: 1e-6, n: 1e-9,
};

function lookupSymbol(sym: string): UnitDef | null {
  if (UNITS[sym]) return UNITS[sym];
  for (const [p, f] of Object.entries(PREFIXES)) {
    if (sym.startsWith(p) && sym.length > p.length) {
      const base = UNITS[sym.slice(p.length)];
      if (base?.prefixable) {
        return { ...base, factor: base.factor * f, name: `${p}${base.name}` };
      }
    }
  }
  return null;
}

export interface ParsedUnit {
  dims: DimVector;
  factor: number;
  offset: number;
}

export class UnitParseError extends Error {}

const SUPER_MAP: Record<string, string> = {
  "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
  "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-",
};

type Tok =
  | { t: "id"; v: string; exp?: number }
  | { t: "num"; v: number }
  | { t: "mul" } | { t: "div" } | { t: "pow" } | { t: "lp" } | { t: "rp" } | { t: "minus" };

function tokenize(src: string): Tok[] {
  // superíndices → ^n
  let s = "";
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (SUPER_MAP[c] !== undefined) {
      let run = "";
      while (i < src.length && SUPER_MAP[src[i]] !== undefined) run += SUPER_MAP[src[i++]];
      i--;
      s += "^" + run;
    } else s += c;
  }

  const toks: Tok[] = [];
  let i = 0;
  const isLetter = (c: string) => /[A-Za-zµμ°ºΩÅ%]/.test(c);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "*" || c === "·" || c === "×" || c === "⋅" || c === ".") { toks.push({ t: "mul" }); i++; continue; }
    if (c === "/") { toks.push({ t: "div" }); i++; continue; }
    if (c === "^") { toks.push({ t: "pow" }); i++; continue; }
    if (c === "(") { toks.push({ t: "lp" }); i++; continue; }
    if (c === ")") { toks.push({ t: "rp" }); i++; continue; }
    if (c === "-" ) {
      // "-" solo (adimensional) o signo de exponente
      if (s.trim() === "-") { toks.push({ t: "id", v: "-" }); i++; continue; }
      toks.push({ t: "minus" }); i++; continue;
    }
    if (/[0-9]/.test(c)) {
      let n = "";
      while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++];
      toks.push({ t: "num", v: parseFloat(n) });
      continue;
    }
    if (isLetter(c)) {
      let id = "";
      while (i < s.length && isLetter(s[i])) id += s[i++];
      // exponente pegado: m3, s-1
      let e = "";
      if (i < s.length && /[0-9]/.test(s[i])) {
        while (i < s.length && /[0-9]/.test(s[i])) e += s[i++];
      } else if (s[i] === "-" && /[0-9]/.test(s[i + 1] ?? "")) {
        e = "-"; i++;
        while (i < s.length && /[0-9]/.test(s[i])) e += s[i++];
      }
      toks.push(e ? { t: "id", v: id, exp: parseInt(e, 10) } : { t: "id", v: id });
      continue;
    }
    throw new UnitParseError(`Carácter no reconocido: "${c}"`);
  }
  return toks;
}

interface Val { dims: DimVector; factor: number; offset: number; offsetUnits: number }

const ONE: Val = { dims: DIMENSIONLESS, factor: 1, offset: 0, offsetUnits: 0 };
const mulV = (a: Val, b: Val): Val => ({
  dims: dimAdd(a.dims, b.dims), factor: a.factor * b.factor, offset: 0, offsetUnits: a.offsetUnits + b.offsetUnits,
});
const powV = (a: Val, p: number): Val => ({
  dims: dimScale(a.dims, p), factor: Math.pow(a.factor, p), offset: 0, offsetUnits: a.offsetUnits + (p !== 1 ? 1 : 0),
});

export function parseUnit(src: string): ParsedUnit {
  const text = src.trim();
  if (text === "") return { dims: DIMENSIONLESS, factor: 1, offset: 0 };

  // Caso especial: una sola unidad con desplazamiento (°C)
  const direct = lookupSymbol(text);
  if (direct) return { dims: direct.dims, factor: direct.factor, offset: direct.offset ?? 0 };

  const toks = tokenize(text);
  let pos = 0;
  const peek = () => toks[pos];

  const parseNumber = (): number => {
    let sign = 1;
    if (peek()?.t === "minus") { sign = -1; pos++; }
    const tk = peek();
    if (tk?.t === "num") { pos++; return sign * tk.v; }
    if (tk?.t === "lp") {
      pos++;
      let s2 = 1;
      if (peek()?.t === "minus") { s2 = -1; pos++; }
      const a = peek(); if (a?.t !== "num") throw new UnitParseError("Exponente inválido");
      pos++;
      let v = s2 * a.v;
      if (peek()?.t === "div") {
        pos++;
        const b = peek(); if (b?.t !== "num") throw new UnitParseError("Exponente inválido");
        pos++; v /= b.v;
      }
      if (peek()?.t !== "rp") throw new UnitParseError("Falta ')' en el exponente");
      pos++;
      return sign * v;
    }
    throw new UnitParseError("Se esperaba un exponente después de '^'");
  };

  const parseFactor = (): Val => {
    const tk = peek();
    if (!tk) throw new UnitParseError("Expresión incompleta");
    if (tk.t === "id") {
      pos++;
      const u = lookupSymbol(tk.v);
      if (!u) throw new UnitParseError(`Unidad desconocida: "${tk.v}"`);
      const v: Val = { dims: u.dims, factor: u.factor, offset: 0, offsetUnits: u.offset ? 1 : 0 };
      return tk.exp !== undefined ? powV(v, tk.exp) : v;
    }
    if (tk.t === "num") {
      pos++;
      return { ...ONE, factor: tk.v };
    }
    if (tk.t === "lp") {
      pos++;
      const v = parseExpr();
      if (peek()?.t !== "rp") throw new UnitParseError("Falta ')'");
      pos++;
      return v;
    }
    throw new UnitParseError("Expresión de unidad inválida");
  };

  const parseTerm = (): Val => {
    let v = parseFactor();
    while (peek()?.t === "pow") {
      pos++;
      v = powV(v, parseNumber());
    }
    return v;
  };

  const startsTerm = (tk?: Tok) => tk && (tk.t === "id" || tk.t === "lp" || tk.t === "num");

  function parseExpr(): Val {
    let result = parseTerm();
    let inDen = false;
    for (;;) {
      const tk = peek();
      if (!tk || tk.t === "rp") break;
      if (tk.t === "div") {
        pos++;
        inDen = true;
        result = mulV(result, powV(parseTerm(), -1));
      } else if (tk.t === "mul" || startsTerm(tk)) {
        if (tk.t === "mul") pos++;
        const t = parseTerm();
        result = mulV(result, inDen ? powV(t, -1) : t);
      } else {
        throw new UnitParseError("Expresión de unidad inválida");
      }
    }
    return result;
  }

  const v = parseExpr();
  if (pos < toks.length) throw new UnitParseError("Paréntesis sin abrir o símbolos sobrantes");
  return { dims: v.dims, factor: v.factor, offset: 0 };
}

/** Intenta interpretar la unidad; devuelve null si es inválida. */
export function tryParseUnit(src: string): ParsedUnit | null {
  try {
    return parseUnit(src);
  } catch {
    return null;
  }
}

export function toSI(value: number, unit: ParsedUnit): number {
  return value * unit.factor + unit.offset;
}
