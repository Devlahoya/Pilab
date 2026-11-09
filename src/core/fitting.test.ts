import { describe, expect, it } from "vitest";
import { analyze, buildRelation, evaluateGroup, fitPowerLaw, parseDelimited } from "./index";
import { TEMPLATES } from "../processes/templates";
import { buildVariables, projectFromTemplate } from "../processes/project";
import { EXAMPLE_DATASETS } from "../processes/datasets";

describe("Ajuste de ley de potencias", () => {
  it("recupera exactamente C y exponentes sin ruido", () => {
    const re = [1e4, 2e4, 5e4, 1e5, 3e4, 8e4];
    const pr = [0.7, 3, 7, 20, 50, 1.5];
    const nu = re.map((r, i) => 0.023 * r ** 0.8 * pr[i] ** 0.4);
    const f = fitPowerLaw(nu, [
      { key: "Re", label: "Re", values: re },
      { key: "Pr", label: "Pr", values: pr },
    ]);
    expect(f.ok).toBe(true);
    expect(f.C).toBeCloseTo(0.023, 8);
    expect(f.groups[0].exponent!).toBeCloseTo(0.8, 8);
    expect(f.groups[1].exponent!).toBeCloseTo(0.4, 8);
    expect(f.r2).toBeCloseTo(1, 10);
  });

  it("detecta grupos constantes y colineales", () => {
    const N = [1, 2, 3, 4, 5];
    const f = fitPowerLaw(N.map((n) => 2 * n ** 1.5), [
      { key: "a", label: "A", values: N },
      { key: "b", label: "B", values: N.map((n) => n * n) }, // colineal con A
      { key: "c", label: "C", values: N.map(() => 3) }, // constante
    ]);
    expect(f.ok).toBe(true);
    expect(f.groups[1].status).toBe("colineal");
    expect(f.groups[1].collinearWith).toEqual(["A"]);
    expect(f.groups[2].status).toBe("constante");
    expect(f.groups[0].exponent!).toBeCloseTo(1.5, 8);
  });

  it("respeta exponentes fijos", () => {
    const x = [1, 2, 4, 8], z = [1, 3, 2, 5];
    const y = x.map((v, i) => 4 * v ** 2 * z[i] ** (1 / 3));
    const f = fitPowerLaw(y, [
      { key: "x", label: "x", values: x },
      { key: "z", label: "z", values: z, fixed: 1 / 3 },
    ]);
    expect(f.groups[1].status).toBe("fijo");
    expect(f.groups[0].exponent!).toBeCloseTo(2, 8);
    expect(f.C).toBeCloseTo(4, 8);
  });

  it("lee tablas pegadas de Excel y CSV con coma decimal", () => {
    const t = parseDelimited("N (rpm)\tP (W)\n100\t1,5\n200\t12\n");
    expect(t.header).toEqual(["N (rpm)", "P (W)"]);
    expect(t.rows).toEqual([["100", "1,5"], ["200", "12"]]);
    const many = parseDelimited("N (rpm)\tP (W)\n200\t0,15\n300\t0,49\n400\t1,2\n500\t2,3\n600\t3,9\n");
    expect(many.delimiter).toBe("\t");
    expect(many.rows).toHaveLength(5);
    const c = parseDelimited("a;b\n1,5;2\n");
    expect(c.delimiter).toBe(";");
    expect(c.rows[0]).toEqual(["1,5", "2"]);
  });
});

describe("Datos de ejemplo", () => {
  function fitTemplate(id: string) {
    const p = projectFromTemplate(TEMPLATES.find((t) => t.id === id)!);
    const { vars } = buildVariables(p.rows);
    const a = analyze({ variables: vars, dependentId: p.dependentId });
    const rel = buildRelation(vars, a, { dependentId: p.dependentId, preferred: p.preferred });
    const ds = EXAMPLE_DATASETS[id]();
    const rowsVars = ds.rows.map((r) => vars.map((v) => ({ ...v, valueSI: r[v.kindId!] ?? v.valueSI })));
    const dep = rowsVars.map((vs) => evaluateGroup(vs, rel.dependent!.exponents)!);
    const groups = rel.independents.map((g) => ({ key: g.symbol, label: g.symbol, values: rowsVars.map((vs) => evaluateGroup(vs, g.exponents)!) }));
    return fitPowerLaw(dep, groups);
  }

  it("convección forzada: recupera Dittus–Boelter", () => {
    const f = fitTemplate("forced-convection");
    expect(f.groups.find((g) => g.key === "Re")!.exponent!).toBeCloseTo(0.8, 1);
    expect(f.groups.find((g) => g.key === "Pr")!.exponent!).toBeCloseTo(0.4, 1);
    expect(f.r2).toBeGreaterThan(0.99);
  });

  it("tubería: Re^-0.25 y (L/D)^1", () => {
    const f = fitTemplate("pipe-flow");
    expect(f.groups.find((g) => g.key === "Re")!.exponent!).toBeCloseTo(-0.25, 1);
    expect(f.groups.find((g) => g.key === "L/D")!.exponent!).toBeCloseTo(1, 1);
  });

  it("tanque agitado: D_t/D constante y Po ≈ 5", () => {
    const f = fitTemplate("agitated-power");
    expect(f.groups.find((g) => g.key === "D_t/D")!.status).toBe("constante");
    expect(f.C).toBeGreaterThan(3);
  });

  it("kLa: Sc constante y We colineal (sólo se variaron N, D y Q_g)", () => {
    const f = fitTemplate("bioreactor-kla");
    expect(f.groups.find((g) => g.key === "Sc")!.status).toBe("constante");
    expect(f.groups.find((g) => g.key === "We")!.status).toBe("colineal");
  });
});
