import { superscript } from "../core";

/** Formato numérico legible: 0.0579, 2.40×10⁴, 1.6×10⁻⁵ */
export function formatValue(x: number | null | undefined, digits = 3): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  if (x === 0 || Math.abs(x) < 1e-30) return "0";
  const ax = Math.abs(x);
  if (ax >= 1e-3 && ax < 1e5) {
    return x.toLocaleString("es-MX", { maximumSignificantDigits: digits });
  }
  const e = Math.floor(Math.log10(ax));
  const m = x / Math.pow(10, e);
  return `${m.toLocaleString("es-MX", { maximumSignificantDigits: digits })}×10${superscript(e)}`;
}
