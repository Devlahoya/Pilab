import { NamedGroup } from "../core";

/** Referencia estable de un grupo para guardar selecciones del usuario. */
export function groupRef(g: NamedGroup): string {
  if (g.source === "biblioteca" && g.primary && g.numberId) return g.numberId;
  if (g.source === "relación" || g.source === "adimensional") return `sym:${g.symbol}`;
  return g.key;
}

export const matchesRef = (g: NamedGroup, ref: string) =>
  ref === groupRef(g) || ref === g.key || ref === g.symbol || ref === `sym:${g.symbol}`;
