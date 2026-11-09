import { useMemo } from "react";
import {
  Criterion,
  NUMBER_BY_ID,
  NamedGroup,
  ProcessVariable,
  Relation,
  SCALE_PRESETS,
  SCALE_RULE_LABEL,
  ScaleRule,
  defaultRule,
  geometricPower,
  groupRatio,
  presetExponents,
  solveScaling,
  tryParseUnit,
} from "../core";
import { ScaleState, VariableRow, parseValue } from "../processes/project";
import { SCALE_DEFAULTS } from "../processes/templates";
import { Correlation } from "../processes/correlation";
import { formatValue } from "./format";
import { groupRef, matchesRef } from "./groups";
import { GroupFormula, Sym } from "./Math";

interface Props {
  vars: ProcessVariable[];
  rows: VariableRow[];
  relation: Relation;
  templateId?: string;
  scale?: ScaleState;
  onChange: (s: ScaleState) => void;
  /** Correlación ajustada con datos (sección 4), si existe. */
  correlation?: Correlation | null;
}


interface CriterionItem {
  ref: string;
  label: string;
  title: string;
  exponents: number[] | NamedGroup["exponents"];
  group?: NamedGroup;
  note?: string;
}

export function ScalePanel({ vars, rows, relation, templateId, scale, onChange, correlation }: Props) {
  const groups = useMemo(
    () => [relation.dependent, ...relation.independents].filter((g): g is NamedGroup => !!g),
    [relation],
  );

  const state: ScaleState = scale ?? {
    lambda: 10,
    rules: {},
    fixed: {},
    criteria: groups.map(groupRef),
  };
  const set = (patch: Partial<ScaleState>) => onChange({ ...state, ...patch });

  const items: CriterionItem[] = useMemo(() => {
    const gi: CriterionItem[] = groups.map((g) => ({
      ref: groupRef(g),
      label: g.symbol,
      title: g.numberId ? NUMBER_BY_ID[g.numberId]?.name ?? g.name : g.name,
      exponents: g.exponents,
      group: g,
    }));
    const pi: CriterionItem[] = SCALE_PRESETS.flatMap((p) => {
      const e = presetExponents(vars, p);
      return e ? [{ ref: `preset:${p.id}`, label: p.short, title: p.label, exponents: e, note: p.note }] : [];
    });
    const fi: CriterionItem[] =
      correlation?.criterion && correlation.fit.ok
        ? [
            {
              ref: "fit",
              label: "f(Π)",
              title: "Usar la correlación ajustada con tus datos",
              exponents: correlation.criterion,
              note: `${correlation.dep.symbol} = ${formatValue(correlation.fit.C, 3)}·${correlation.fit.groups
                .map((r, j) => (r.exponent !== null && (r.status === "ajustado" || r.status === "fijo") ? `${correlation.entries[j].g.symbol}^${r.exponent.toFixed(2)}` : null))
                .filter(Boolean)
                .join("·")} (sección 4). Permite predecir la variable de interés aunque los demás grupos cambien.`,
            },
          ]
        : [];
    return [...fi, ...gi, ...pi];
  }, [groups, vars, correlation]);

  const isOn = (it: CriterionItem) =>
    state.criteria.some((ref) => (it.group ? matchesRef(it.group, ref) : ref === it.ref));

  const toggle = (it: CriterionItem) => {
    const on = isOn(it);
    const rest = state.criteria.filter((ref) => !(it.group ? matchesRef(it.group, ref) : ref === it.ref));
    set({ criteria: on ? rest : [...rest, it.ref] });
  };

  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const ruleOf = (v: ProcessVariable): ScaleRule => state.rules[v.id] ?? defaultRule(v);

  // Factores de variables con valor fijo
  const fixedFactors: Record<string, number | null> = {};
  for (const v of vars) {
    if (ruleOf(v) !== "fijo") continue;
    const row = rowById.get(v.id);
    const unit = row ? tryParseUnit(row.unit) : null;
    const proto = parseValue(state.fixed[v.id] ?? "");
    if (proto === null || !unit) {
      fixedFactors[v.id] = null;
    } else if (v.valueSI) {
      fixedFactors[v.id] = (proto * unit.factor + unit.offset) / v.valueSI;
    } else {
      fixedFactors[v.id] = proto; // sin valor del modelo: se interpreta como factor
    }
  }

  const criteria: Criterion[] = items.filter(isOn).map((it) => ({ key: it.ref, exponents: it.exponents }));
  const result = solveScaling({
    vars,
    rules: Object.fromEntries(vars.map((v) => [v.id, ruleOf(v)])),
    lambda: state.lambda,
    fixedFactors,
    criteria,
  });

  const firstGeom = vars.find((v) => geometricPower(v) === 1 && v.valueSI);
  const defaults = templateId ? SCALE_DEFAULTS[templateId] : undefined;
  const symbolsOf = (ids: string[]) => ids.map((id) => vars.find((v) => v.id === id)?.symbol ?? "?");
  const labelOf = (ref: string) => items.find((i) => i.ref === ref)?.label ?? ref;

  if (!vars.length) return <p className="muted">Agrega variables para poder escalar el proceso.</p>;

  return (
    <div className="scale">
      <details className="whatif-box">
        <summary>¿Cómo funciona el escalamiento?</summary>
        <p>
          El <strong>modelo</strong> es tu equipo actual (los valores de la tabla de variables) y el <strong>prototipo</strong>{" "}
          es el equipo más grande. Si todos los grupos adimensionales valen lo mismo en ambos, el proceso se comporta
          igual: eso es la <strong>similitud</strong>.
        </p>
        <ol>
          <li>Indica cuánto más grande es la planta (λ). Todas las longitudes se multiplican por λ.</li>
          <li>Decide qué no cambia (normalmente el mismo fluido: ρ, μ, σ…) y qué quieres calcular.</li>
          <li>
            Marca qué grupos o criterios mantener constantes. Necesitas tantos criterios como variables por calcular.
          </li>
        </ol>
        <p>
          Si marcas criterios que chocan entre sí (por ejemplo Re y Fr con el mismo fluido), la app te lo dice: en la
          práctica se elige el más importante para el proceso (<em>similitud parcial</em>).
        </p>
      </details>

      {defaults?.note && !scale && <p className="muted small">{defaults.note}</p>}
      {defaults?.note && scale && <p className="muted small">Sugerencia de la plantilla: {defaults.note}</p>}

      <div className="scale-size">
        <label className="field">
          <span>Factor de escala geométrico λ</span>
          <input
            className="input"
            type="number"
            min="0"
            step="any"
            value={Number.isFinite(state.lambda) ? +state.lambda.toPrecision(6) : ""}
            onChange={(e) => set({ lambda: parseFloat(e.target.value) })}
          />
        </label>
        <span className="scale-or">o</span>
        <label className="field">
          <span>Volumen de la planta = volumen del modelo ×</span>
          <input
            className="input"
            type="number"
            min="0"
            step="any"
            value={Number.isFinite(state.lambda) ? +Math.pow(state.lambda, 3).toPrecision(6) : ""}
            onChange={(e) => set({ lambda: Math.cbrt(parseFloat(e.target.value)) })}
          />
        </label>
        {firstGeom && Number.isFinite(state.lambda) && (
          <p className="scale-example">
            <Sym s={firstGeom.symbol} />: {formatValue(displayValue(firstGeom.valueSI!, rowById.get(firstGeom.id)))}{" "}
            {rowById.get(firstGeom.id)?.unit} → <strong>{formatValue(displayValue(firstGeom.valueSI! * state.lambda, rowById.get(firstGeom.id)))}</strong>{" "}
            {rowById.get(firstGeom.id)?.unit}
          </p>
        )}
      </div>

      <StatusBanner
        status={result.status}
        message={result.message}
        missing={result.missing}
        undetermined={symbolsOf(result.undeterminedIds)}
        conflicts={result.conflictKeys.map(labelOf)}
      />

      <div className="scale-grid">
        <section>
          <h3>¿Qué se mantiene constante?</h3>
          <ul className="crit-list">
            {items.map((it) => {
              const on = isOn(it);
              const ratio = groupRatio(vars, it.exponents, result.factors);
              const conflict = result.conflictKeys.includes(it.ref);
              const redundant = on && result.redundantKeys.includes(it.ref);
              return (
                <li key={it.ref} className={`crit ${on ? "crit-on" : ""} ${conflict ? "crit-conflict" : ""}`}>
                  <label>
                    <input type="checkbox" checked={on} onChange={() => toggle(it)} />
                    <span className="crit-sym">
                      <Sym s={it.label} />
                    </span>
                    <span className="crit-body">
                      <span className="crit-title">{it.title}</span>
                      {it.group ? (
                        <span className="crit-formula">
                          <GroupFormula vars={vars} exponents={it.group.exponents} termOrder={it.group.termOrder} />
                        </span>
                      ) : (
                        <span className="crit-note">{it.note}</span>
                      )}
                    </span>
                  </label>
                  <span className="crit-status">
                    {conflict && <span className="tag tag-warn">en conflicto</span>}
                    {redundant && <span className="tag">se cumple solo</span>}
                    <RatioTag ratio={ratio} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <h3>Variables: modelo → planta</h3>
          <div className="table-scroll">
            <table className="scale-table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>¿Cómo cambia?</th>
                  <th>Modelo</th>
                  <th>Planta</th>
                  <th>Factor</th>
                </tr>
              </thead>
              <tbody>
                {vars.map((v) => {
                  const row = rowById.get(v.id);
                  const rule = ruleOf(v);
                  const f = result.factors[v.id];
                  const undetermined = result.undeterminedIds.includes(v.id);
                  const geomOk = geometricPower(v) !== null;
                  return (
                    <tr key={v.id} className={undetermined ? "is-undetermined" : ""}>
                      <td>
                        <Sym s={v.symbol} />
                        <span className="muted small scale-name">{v.name}</span>
                      </td>
                      <td>
                        <select
                          className="input select"
                          value={rule}
                          onChange={(e) => set({ rules: { ...state.rules, [v.id]: e.target.value as ScaleRule } })}
                        >
                          {(["igual", "geometria", "fijo", "calcular"] as ScaleRule[])
                            .filter((r) => r !== "geometria" || geomOk)
                            .map((r) => (
                              <option key={r} value={r}>
                                {SCALE_RULE_LABEL[r]}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="num">
                        {v.valueSI != null ? `${formatValue(displayValue(v.valueSI, row))} ${row?.unit ?? ""}` : "—"}
                      </td>
                      <td className="num">
                        {rule === "fijo" ? (
                          <span className="fixed-input">
                            {!v.valueSI && <span>×</span>}
                            <input
                              className="input"
                              inputMode="decimal"
                              placeholder={v.valueSI ? "valor" : "factor"}
                              value={state.fixed[v.id] ?? ""}
                              onChange={(e) => set({ fixed: { ...state.fixed, [v.id]: e.target.value } })}
                            />
                            {v.valueSI ? <span className="muted small">{row?.unit}</span> : null}
                          </span>
                        ) : f != null && v.valueSI != null ? (
                          <strong>
                            {formatValue(displayValue(v.valueSI * f, row))} {row?.unit}
                          </strong>
                        ) : undetermined ? (
                          <span className="muted">?</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num">{f != null ? `×${formatValue(f)}` : undetermined ? "?" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {result.status === "ok" && <RatioChart vars={vars} groups={groups} factors={result.factors} />}
    </div>
  );
}

/** Convierte un valor SI a las unidades de la fila. */
function displayValue(si: number, row?: VariableRow): number {
  const u = row ? tryParseUnit(row.unit) : null;
  return u ? (si - u.offset) / u.factor : si;
}

function RatioTag({ ratio }: { ratio: number | null }) {
  if (ratio === null) return <span className="tag">?</span>;
  const same = Math.abs(Math.log10(ratio)) < 1e-6;
  return (
    <span className={`tag ${same ? "tag-ok" : "tag-info"}`} title="Valor en planta / valor en el modelo">
      {same ? "= igual" : `×${formatValue(ratio)}`}
    </span>
  );
}

function StatusBanner({
  status,
  message,
  missing,
  undetermined,
  conflicts,
}: {
  status: string;
  message?: string;
  missing: number;
  undetermined: string[];
  conflicts: string[];
}) {
  if (status === "invalido") return <div className="alert alert-warn">{message}</div>;
  if (status === "ok")
    return (
      <div className="alert alert-ok">
        ✓ Solución única: todos los criterios marcados se cumplen. Revisa abajo cuánto cambia cada número que no
        mantuviste.
      </div>
    );
  if (status === "incompatible")
    return (
      <div className="alert alert-error">
        Los criterios marcados no se pueden cumplir a la vez
        {conflicts.length ? (
          <>
            : <strong>{conflicts.join(", ")}</strong> chocan entre sí. Desmarca uno de ellos (similitud parcial) o
            cambia el fluido del prototipo («Calcular» en alguna propiedad).
          </>
        ) : (
          ". Revisa las reglas de las variables."
        )}
      </div>
    );
  return (
    <div className="alert alert-warn">
      Falta{missing > 1 ? "n" : ""} {missing} criterio{missing > 1 ? "s" : ""} para calcular{" "}
      <strong>{undetermined.join(", ")}</strong>. Marca otro grupo o criterio, o da su valor en planta con «Valor fijo».
    </div>
  );
}

/** Barras horizontales: cuánto cambia cada grupo (escala logarítmica). */
function RatioChart({ vars, groups, factors }: { vars: ProcessVariable[]; groups: NamedGroup[]; factors: Record<string, number | null> }) {
  const data = groups.map((g) => ({ g, r: groupRatio(vars, g.exponents, factors) })).filter((d) => d.r !== null) as { g: NamedGroup; r: number }[];
  if (!data.length) return null;
  const maxLog = Math.max(1, ...data.map((d) => Math.abs(Math.log10(d.r))));
  return (
    <section className="ratio-chart">
      <h3>¿Cuánto cambia cada número al escalar?</h3>
      <p className="muted small">
        Barra hacia la derecha: el número crece en la planta; hacia la izquierda: disminuye. Sin barra: se conserva.
      </p>
      <div className="ratio-rows">
        {data.map(({ g, r }) => {
          const lg = Math.log10(r);
          const w = (Math.abs(lg) / maxLog) * 50;
          const same = Math.abs(lg) < 1e-6;
          return (
            <div key={g.key} className="ratio-row">
              <span className="ratio-sym">
                <Sym s={g.symbol} />
              </span>
              <span className="ratio-track">
                <span className="ratio-axis" />
                {!same && (
                  <span
                    className={`ratio-bar ${lg > 0 ? "up" : "down"}`}
                    style={lg > 0 ? { left: "50%", width: `${w}%` } : { right: "50%", width: `${w}%` }}
                  />
                )}
              </span>
              <span className="ratio-val">{same ? "igual" : `×${formatValue(r)}`}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
