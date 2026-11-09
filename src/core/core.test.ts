import { describe, expect, it } from "vitest";
import {
  Fraction,
  analyze,
  buildRelation,
  dim,
  evaluateGroup,
  formatDim,
  groupToText,
  isGroupDimensionless,
  nullspace,
  parseUnit,
  rank,
  toMatrix,
} from "./index";
import { TEMPLATES } from "../processes/templates";
import { buildVariables, projectFromTemplate } from "../processes/project";

describe("Fraction", () => {
  it("normaliza y opera exactamente", () => {
    expect(new Fraction(2, -4).toString()).toBe("-1/2");
    expect(new Fraction(1, 3).add(new Fraction(1, 6)).toString()).toBe("1/2");
    expect(Fraction.from(0.5).toString()).toBe("1/2");
    expect(Fraction.from(-1.5).toString()).toBe("-3/2");
  });
});

describe("Unidades", () => {
  const close = (a: number, b: number) => expect(Math.abs(a - b) / Math.abs(b)).toBeLessThan(1e-9);

  it("reconoce unidades compuestas", () => {
    expect(parseUnit("Pa·s").dims).toEqual(dim({ M: 1, L: -1, T: -1 }));
    expect(parseUnit("kg/(m*s)").dims).toEqual(dim({ M: 1, L: -1, T: -1 }));
    expect(parseUnit("W/(m²·K)").dims).toEqual(dim({ M: 1, T: -3, Θ: -1 }));
    expect(parseUnit("kg/m3").dims).toEqual(dim({ M: 1, L: -3 }));
    expect(parseUnit("m^2/s").dims).toEqual(dim({ L: 2, T: -1 }));
    expect(parseUnit("1/s").dims).toEqual(dim({ T: -1 }));
    expect(parseUnit("s^-1").dims).toEqual(dim({ T: -1 }));
  });

  it("aplica la convención de ingeniería J/kg·K = J/(kg·K)", () => {
    expect(parseUnit("J/kg·K").dims).toEqual(parseUnit("J/(kg·K)").dims);
  });

  it("convierte al SI con prefijos y unidades comunes", () => {
    close(parseUnit("cP").factor, 1e-3);
    close(parseUnit("rpm").factor, 1 / 60);
    close(parseUnit("L/min").factor, 1e-3 / 60);
    close(parseUnit("mm").factor, 1e-3);
    close(parseUnit("kPa").factor, 1e3);
    close(parseUnit("m³/h").factor, 1 / 3600);
    close(parseUnit("mM").factor, 1);
    expect(parseUnit("°C").offset).toBe(273.15);
  });

  it("rechaza unidades desconocidas", () => {
    expect(() => parseUnit("foo")).toThrow();
    expect(() => parseUnit("kg/(m")).toThrow();
  });

  it("formatea dimensiones", () => {
    expect(formatDim(dim({ M: 1, L: -1, T: -1 }))).toBe("M L⁻¹ T⁻¹");
  });
});

describe("Álgebra lineal", () => {
  it("calcula rango y espacio nulo", () => {
    // Matriz dimensional de (ρ, v, D, μ)
    const M = toMatrix([
      [1, 0, 0, 1], // M
      [-3, 1, 1, -1], // L
      [0, -1, 0, -1], // T
    ]);
    expect(rank(M)).toBe(3);
    const ns = nullspace(M);
    expect(ns).toHaveLength(1);
    // proporcional a Re = ρ v D / μ
    const v = ns[0].map((x) => x.toNumber());
    expect(v[1] / v[0]).toBeCloseTo(1);
    expect(v[2] / v[0]).toBeCloseTo(1);
    expect(v[3] / v[0]).toBeCloseTo(-1);
  });
});

function fromTemplate(id: string) {
  const t = TEMPLATES.find((x) => x.id === id)!;
  const p = projectFromTemplate(t);
  const { vars, unitErrors } = buildVariables(p.rows);
  expect(unitErrors).toEqual({});
  const a = analyze({ variables: vars, dependentId: p.dependentId });
  const rel = buildRelation(vars, a, { dependentId: p.dependentId, preferred: p.preferred });
  const text = `${rel.dependent?.symbol} = f(${rel.independents.map((g) => g.symbol).join(", ")})`;
  return { vars, a, rel, text };
}

describe("Teorema Π de Buckingham", () => {
  it("tubería: 7 variables, 3 dimensiones → 4 grupos", () => {
    const { a, text } = fromTemplate("pipe-flow");
    expect(a.n).toBe(7);
    expect(a.rank).toBe(3);
    expect(a.k).toBe(4);
    expect(text).toBe("Eu = f(Re, L/D, ε/D)");
  });

  it("todos los grupos del método clásico son adimensionales", () => {
    for (const t of TEMPLATES) {
      const { vars, a } = fromTemplate(t.id);
      expect(a.groups).toHaveLength(a.k);
      for (const g of a.groups) expect(isGroupDimensionless(vars, g.exponents)).toBe(true);
    }
  });

  it("cada plantilla produce una relación completa", () => {
    for (const t of TEMPLATES) {
      const { rel } = fromTemplate(t.id);
      expect(rel.complete, t.id).toBe(true);
      expect(rel.dependent, t.id).toBeDefined();
    }
  });

  it("tanque agitado: Po = f(Re, Fr, D_t/D) y Po ≈ 5", () => {
    const { vars, rel, text } = fromTemplate("agitated-power");
    expect(text).toBe("Po = f(Re, Fr, D_t/D)");
    const po = evaluateGroup(vars, rel.dependent!.exponents)!;
    expect(po).toBeGreaterThan(4.5);
    expect(po).toBeLessThan(5.5);
    expect(groupToText(vars, rel.dependent!.exponents, rel.dependent!.termOrder)).toBe("P/(ρ·N³·D⁵)");
  });

  it("biorreactor kLa: 9 variables → 6 grupos", () => {
    const { a, text } = fromTemplate("bioreactor-kla");
    expect(a.k).toBe(6);
    expect(text).toBe("kLa/N = f(Re, Fr, Fl, We, Sc)");
  });

  it("convección forzada: Nu = f(Re, Pr)", () => {
    expect(fromTemplate("forced-convection").text).toBe("Nu = f(Re, Pr)");
  });

  it("transferencia de masa: Sh = f(Re, Sc)", () => {
    expect(fromTemplate("convective-mass").text).toBe("Sh = f(Re, Sc)");
  });

  it("bomba: ψ = f(Fl, Re)", () => {
    expect(fromTemplate("centrifugal-pump").text).toBe("ψ = f(Fl, Re)");
  });

  it("burbujas: Re = f(Eo, Mo, Δρ/ρ)", () => {
    expect(fromTemplate("bubble-rise").text).toBe("Re = f(Eo, Mo, Δρ/ρ)");
  });

  it("péndulo: detecta que la masa no influye y da t²g/L", () => {
    const { a, vars, rel } = fromTemplate("pendulum");
    const mass = vars.find((v) => v.symbol === "m")!;
    expect(a.isolatedIds).toContain(mass.id);
    expect(a.warnings.some((w) => w.message.includes("masa"))).toBe(true);
    expect(groupToText(vars, rel.dependent!.exponents)).toBe("t²·g/L");
  });

  it("respeta variables repetidas elegidas por el usuario", () => {
    const { vars } = fromTemplate("pipe-flow");
    const ids = ["ΔP", "D", "μ"].map((s) => vars.find((v) => v.symbol === s)!.id);
    const a = analyze({ variables: vars, repeatingIds: ids });
    expect(a.repeatingValid).toBe(true);
    expect(a.groups).toHaveLength(4);
  });

  it("rechaza variables repetidas dependientes entre sí", () => {
    const { vars } = fromTemplate("pipe-flow");
    const ids = ["D", "L", "ρ"].map((s) => vars.find((v) => v.symbol === s)!.id);
    const a = analyze({ variables: vars, repeatingIds: ids });
    expect(a.repeatingValid).toBe(false);
  });
});
