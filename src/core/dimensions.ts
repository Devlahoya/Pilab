/**
 * Dimensiones fundamentales del SI.
 *
 * Toda magnitud física se expresa como M^a · L^b · T^c · Θ^d · N^e · I^f · J^g.
 * El vector de exponentes [a, b, c, d, e, f, g] es la "fórmula dimensional".
 */

export const BASE_DIMENSIONS = [
  { key: "M", name: "Masa", siUnit: "kg" },
  { key: "L", name: "Longitud", siUnit: "m" },
  { key: "T", name: "Tiempo", siUnit: "s" },
  { key: "Θ", name: "Temperatura", siUnit: "K" },
  { key: "N", name: "Cantidad de sustancia", siUnit: "mol" },
  { key: "I", name: "Corriente eléctrica", siUnit: "A" },
  { key: "J", name: "Intensidad luminosa", siUnit: "cd" },
] as const;

export const DIM_COUNT = BASE_DIMENSIONS.length;

export type DimVector = readonly number[]; // longitud DIM_COUNT

export const DIMENSIONLESS: DimVector = Object.freeze([0, 0, 0, 0, 0, 0, 0]);

/** Construye un vector dimensional a partir de un objeto parcial, p. ej. { M: 1, L: -1, T: -1 }. */
export function dim(parts: Partial<Record<"M" | "L" | "T" | "Θ" | "N" | "I" | "J", number>>): DimVector {
  return BASE_DIMENSIONS.map((d) => parts[d.key] ?? 0);
}

export function dimAdd(a: DimVector, b: DimVector): DimVector {
  return a.map((x, i) => x + b[i] || 0);
}

export function dimScale(a: DimVector, k: number): DimVector {
  return a.map((x) => x * k || 0); // evita -0
}

export function dimEquals(a: DimVector, b: DimVector): boolean {
  return a.every((x, i) => Math.abs(x - b[i]) < 1e-9);
}

export function isDimensionless(a: DimVector): boolean {
  return a.every((x) => Math.abs(x) < 1e-9);
}

const SUPERSCRIPT: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴",
  "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "-": "⁻", "/": "ᐟ", ".": "·",
};

export function superscript(s: string | number): string {
  return String(s)
    .split("")
    .map((c) => SUPERSCRIPT[c] ?? c)
    .join("");
}

function formatExponent(x: number): string {
  if (Number.isInteger(x)) return String(x);
  // fracciones sencillas
  for (const d of [2, 3, 4, 5, 6]) {
    const n = x * d;
    if (Math.abs(n - Math.round(n)) < 1e-9) return `${Math.round(n)}/${d}`;
  }
  return x.toFixed(3);
}

/** Formato legible: "M L⁻¹ T⁻¹". Devuelve "1" si es adimensional. */
export function formatDim(v: DimVector): string {
  const parts: string[] = [];
  v.forEach((e, i) => {
    if (Math.abs(e) < 1e-9) return;
    const key = BASE_DIMENSIONS[i].key;
    parts.push(e === 1 ? key : key + superscript(formatExponent(e)));
  });
  return parts.length ? parts.join(" ") : "1 (adimensional)";
}
