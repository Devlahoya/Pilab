import { describe, expect, it } from "vitest";
import { Criterion, SCALE_PRESETS, analyze, buildRelation, groupRatio, presetExponents, solveScaling } from "./index";
import { TEMPLATES } from "../processes/templates";
import { buildVariables, projectFromTemplate } from "../processes/project";

function setup(id: string) {
  const p = projectFromTemplate(TEMPLATES.find((t) => t.id === id)!);
  const { vars } = buildVariables(p.rows);
  const a = analyze({ variables: vars, dependentId: p.dependentId });
  const rel = buildRelation(vars, a, { dependentId: p.dependentId, preferred: p.preferred });
  const groups = [rel.dependent!, ...rel.independents];
  const bySymbol = (s: string): Criterion => {
    const g = groups.find((x) => x.symbol === s)!;
    return { key: s, exponents: g.exponents };
  };
  const preset = (pid: string): Criterion => ({ key: pid, exponents: presetExponents(vars, SCALE_PRESETS.find((x) => x.id === pid)!)! });
  const id_ = (s: string) => vars.find((v) => v.symbol === s)!.id;
  return { vars, groups, bySymbol, preset, id_ };
}

describe("Escalamiento", () => {
  it("tanque agitado a P/V constante y Po constante: N ∝ λ^(-2/3), P ∝ λ³", () => {
    const { vars, bySymbol, preset, id_ } = setup("agitated-power");
    const r = solveScaling({ vars, rules: {}, lambda: 10, fixedFactors: {}, criteria: [bySymbol("Po"), preset("PV")] });
    expect(r.status).toBe("ok");
    expect(r.factors[id_("N")]!).toBeCloseTo(Math.pow(10, -2 / 3), 6);
    expect(r.factors[id_("P")]!).toBeCloseTo(1000, 6);
    expect(r.factors[id_("D")]!).toBeCloseTo(10, 9);
  });

  it("Re y Fr constantes con el mismo fluido son incompatibles", () => {
    const { vars, bySymbol } = setup("agitated-power");
    const r = solveScaling({ vars, rules: {}, lambda: 10, fixedFactors: {}, criteria: [bySymbol("Po"), bySymbol("Re"), bySymbol("Fr"), bySymbol("D_t/D")] });
    expect(r.status).toBe("incompatible");
    expect(r.conflictKeys.sort()).toEqual(["Fr", "Re"]);
  });

  it("detecta criterios faltantes", () => {
    const { vars, bySymbol, id_ } = setup("agitated-power");
    const r = solveScaling({ vars, rules: {}, lambda: 10, fixedFactors: {}, criteria: [bySymbol("Po")] });
    expect(r.status).toBe("incompleto");
    expect(r.missing).toBe(1);
    expect(r.undeterminedIds).toContain(id_("N"));
  });

  it("D_t/D se cumple solo con similitud geométrica (redundante)", () => {
    const { vars, bySymbol, preset } = setup("agitated-power");
    const r = solveScaling({ vars, rules: {}, lambda: 4, fixedFactors: {}, criteria: [bySymbol("Po"), preset("PV"), bySymbol("D_t/D")] });
    expect(r.status).toBe("ok");
    expect(r.redundantKeys).toContain("D_t/D");
  });

  it("tubería con similitud completa: v ∝ 1/λ, ΔP ∝ 1/λ²", () => {
    const { vars, groups, id_ } = setup("pipe-flow");
    const criteria = groups.map((g) => ({ key: g.symbol, exponents: g.exponents }));
    const r = solveScaling({ vars, rules: {}, lambda: 5, fixedFactors: {}, criteria });
    expect(r.status).toBe("ok");
    expect(r.factors[id_("v")]!).toBeCloseTo(0.2, 9);
    expect(r.factors[id_("ΔP")]!).toBeCloseTo(0.04, 9);
    for (const g of groups) expect(groupRatio(vars, g.exponents, r.factors)!).toBeCloseTo(1, 9);
  });

  it("bomba: leyes de afinidad con N fija", () => {
    const { vars, bySymbol, id_ } = setup("centrifugal-pump");
    const N = id_("N");
    const r = solveScaling({ vars, rules: { [N]: "igual" }, lambda: 2, fixedFactors: {}, criteria: [bySymbol("ψ"), bySymbol("Fl")] });
    expect(r.status).toBe("ok");
    expect(r.factors[id_("Q")]!).toBeCloseTo(8, 9); // Q ∝ N·D³
    expect(r.factors[id_("ΔP")]!).toBeCloseTo(4, 9); // ΔP ∝ N²·D²
  });

  it("valor fijo: dar la potencia en planta determina N", () => {
    const { vars, bySymbol, id_ } = setup("agitated-power");
    const r = solveScaling({ vars, rules: { [id_("P")]: "fijo" }, lambda: 10, fixedFactors: { [id_("P")]: 1000 }, criteria: [bySymbol("Po")] });
    expect(r.status).toBe("ok");
    expect(r.factors[id_("N")]!).toBeCloseTo(Math.pow(10, -2 / 3), 6);
  });
});
