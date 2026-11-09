import { useRef, useState } from "react";
import { ProcessVariable, Relation, cleanHeader, parseDelimited, tryParseUnit } from "../core";
import { Correlation } from "../processes/correlation";
import { EXAMPLE_DATASETS } from "../processes/datasets";
import { DataState, VariableRow } from "../processes/project";
import { LogChart } from "./LogChart";
import { Sym } from "./Math";
import { formatValue } from "./format";

interface Props {
  vars: ProcessVariable[];
  varRows: VariableRow[];
  relation: Relation;
  templateId?: string;
  data?: DataState;
  correlation: Correlation | null;
  onChange: (d: DataState | undefined) => void;
  notify: (msg: string, ms?: number) => void;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\s_]/g, "").toLowerCase();
const fmtExp = (x: number) => (Math.abs(x) < 0.0005 ? "0" : x.toFixed(Math.abs(x) >= 10 ? 1 : 3).replace(/\.?0+$/, ""));

export function DataPanel({ vars, varRows, relation, templateId, data, correlation, onChange, notify }: Props) {
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const state: DataState = data ?? { rows: [], exclude: [], fixed: {} };
  const set = (patch: Partial<DataState>) => onChange({ ...state, ...patch });
  const example = templateId ? EXAMPLE_DATASETS[templateId] : undefined;
  const rowOf = (id: string) => varRows.find((r) => r.id === id);

  if (!relation.dependent) {
    return (
      <p className="muted">
        Marca la variable de interés (●) en la tabla de variables para poder ajustar una correlación con tus datos.
      </p>
    );
  }

  /* ─── importación */
  const importText = (text: string, source: string) => {
    const t = parseDelimited(text);
    if (!t.rows.length) {
      notify("No se encontraron datos en el texto.");
      return;
    }
    let mapping: (string | null)[];
    if (t.header) {
      mapping = t.header.map((h) => {
        const c = norm(cleanHeader(h));
        const v = vars.find((x) => norm(x.symbol) === c) ?? vars.find((x) => norm(x.name) === c);
        return v?.id ?? null;
      });
    } else {
      mapping = t.rows[0].map((_, i) => vars[i]?.id ?? null);
    }
    const rows = t.rows.map((cells) => {
      const r: Record<string, string> = {};
      cells.forEach((c, i) => {
        const id = mapping[i];
        if (id && c !== "") r[id] = c;
      });
      return r;
    });
    const mapped = mapping.filter(Boolean).map((id) => vars.find((v) => v.id === id)!.symbol);
    const ignored = t.header ? t.header.filter((_, i) => !mapping[i]) : [];
    const missing = vars.filter((v) => !mapping.includes(v.id)).map((v) => v.symbol);
    onChange({ ...state, rows, source });
    notify(
      `Se importaron ${rows.length} experimentos. Columnas: ${mapped.join(", ") || "ninguna"}.` +
        (missing.length ? ` Sin columna (se usa el valor de la tabla): ${missing.join(", ")}.` : "") +
        (ignored.length ? ` Ignoradas: ${ignored.join(", ")}.` : ""),
      6000,
    );
  };

  const loadExample = () => {
    if (!example) return;
    const ds = example();
    const rows = ds.rows.map((r) => {
      const out: Record<string, string> = {};
      for (const v of vars) {
        const si = v.kindId !== undefined ? r[v.kindId] : undefined;
        if (si === undefined) continue;
        const u = tryParseUnit(rowOf(v.id)?.unit ?? "");
        const val = u ? (si - u.offset) / u.factor : si;
        out[v.id] = String(+val.toPrecision(4));
      }
      return out;
    });
    onChange({ rows, exclude: [], fixed: {}, source: `Datos de ejemplo. ${ds.description} Generados con ${ds.source} y ±4 % de ruido.` });
  };

  const downloadCsv = () => {
    const head = vars.map((v) => `${v.symbol} (${rowOf(v.id)?.unit || "1"})`);
    const lines = [head.join(","), ...state.rows.map((r) => vars.map((v) => (r[v.id] ?? "").replace(",", ".")).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "experimentos.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const setCell = (k: number, id: string, value: string) => {
    const rows = state.rows.map((r, i) => (i === k ? { ...r, [id]: value } : r));
    set({ rows });
  };

  const fit = correlation?.fit;
  const dep = relation.dependent;

  return (
    <div className="data">
      <details className="whatif-box">
        <summary>¿Para qué sirve esta sección?</summary>
        <p>
          El análisis dimensional te dice <strong>de qué</strong> depende el proceso, Π₀ = f(Π₁, Π₂, …), pero no{" "}
          <strong>cómo</strong>: la función f sale de experimentos. Lo más común es una ley de potencias:
        </p>
        <p className="center-formula">
          Π₀ = C · Π₁<sup>a</sup> · Π₂<sup>b</sup> · …
        </p>
        <p>
          Captura tus mediciones (una fila por experimento), y la app calcula los grupos y encuentra C y los
          exponentes por mínimos cuadrados. También te avisa si un grupo no cambió en tus experimentos, o si dos
          cambiaron siempre juntos (en ese caso sus efectos no se pueden separar y conviene diseñar otro experimento).
        </p>
        <p>
          Las celdas vacías usan el valor de la tabla de variables: sólo llena las columnas que cambiaste. Puedes
          pegar directamente desde Excel o Google Sheets (con encabezados con los símbolos, p. ej. «N (rpm)»).
        </p>
      </details>

      <div className="data-toolbar">
        <button className="btn btn-sm btn-primary" onClick={() => setPasteOpen(true)}>
          Pegar desde Excel
        </button>
        <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
          Abrir CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) importText(await f.text(), `Archivo ${f.name}`);
            e.target.value = "";
          }}
        />
        {example && (
          <button className="btn btn-sm" onClick={loadExample}>
            Cargar datos de ejemplo
          </button>
        )}
        <button className="btn btn-sm" onClick={() => set({ rows: [...state.rows, {}] })}>
          ＋ Experimento
        </button>
        {state.rows.length > 0 && (
          <>
            <button className="btn btn-sm" onClick={downloadCsv}>
              Descargar CSV
            </button>
            <button
              className="btn btn-sm btn-ghost danger-text"
              onClick={() => {
                if (window.confirm("¿Borrar todos los experimentos de este análisis?")) onChange(undefined);
              }}
            >
              Borrar datos
            </button>
          </>
        )}
      </div>

      {state.source && <p className="muted small">{state.source}</p>}

      {state.rows.length === 0 ? (
        <div className="empty">
          <p>
            Aún no hay experimentos.{" "}
            {example ? "Prueba con «Cargar datos de ejemplo» para ver cómo funciona, o pega tus datos." : "Pega tus datos desde Excel o agrega experimentos a mano."}
          </p>
        </div>
      ) : (
        <div className="table-scroll data-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                {vars.map((v) => (
                  <th key={v.id}>
                    <Sym s={v.symbol} />
                    <span className="unit">{rowOf(v.id)?.unit}</span>
                  </th>
                ))}
                <th className="group-col">
                  <Sym s={dep.symbol} />
                </th>
                {relation.independents.map((g) => (
                  <th key={g.key} className="group-col">
                    <Sym s={g.symbol} />
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r, k) => {
                const droppedRow = fit?.dropped.includes(k);
                return (
                  <tr key={k} className={droppedRow ? "is-dropped" : ""} title={droppedRow ? "Fila incompleta o con valores ≤ 0: no se usa en el ajuste" : undefined}>
                    <td className="muted">{k + 1}</td>
                    {vars.map((v) => (
                      <td key={v.id}>
                        <input
                          className="input cell-input"
                          inputMode="decimal"
                          value={r[v.id] ?? ""}
                          placeholder={v.valueSI != null ? formatValue(displayOf(v, rowOf(v.id))) : "—"}
                          onChange={(e) => setCell(k, v.id, e.target.value)}
                          aria-label={`${v.symbol}, experimento ${k + 1}`}
                        />
                      </td>
                    ))}
                    <td className="group-col num">{formatValue(correlation?.depValues[k])}</td>
                    {correlation?.entries.map((e) => (
                      <td key={e.ref} className="group-col num">
                        {formatValue(e.values[k])}
                      </td>
                    ))}
                    <td>
                      <button className="icon-btn danger" title="Quitar experimento" onClick={() => set({ rows: state.rows.filter((_, i) => i !== k) })}>
                        ✕
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {correlation && fit && state.rows.length > 0 && (
        <div className="fit">
          <div className="fit-grid">
            <section>
              <h3>Grupos en la correlación</h3>
              <ul className="crit-list">
                {correlation.entries.map((e, j) => {
                  const r = fit.groups[j];
                  const excluded = state.exclude.includes(e.ref);
                  return (
                    <li key={e.ref} className={`crit ${!excluded ? "crit-on" : ""}`}>
                      <label>
                        <input
                          type="checkbox"
                          checked={!excluded}
                          onChange={() =>
                            set({ exclude: excluded ? state.exclude.filter((x) => x !== e.ref) : [...state.exclude, e.ref] })
                          }
                        />
                        <span className="crit-sym">
                          <Sym s={e.g.symbol} />
                        </span>
                        <span className="crit-body">
                          <span className="crit-title">{statusText(r)}</span>
                        </span>
                      </label>
                      <span className="fixed-exp" title="Escribe un valor para imponer el exponente (p. ej. 1/3 = 0.333)">
                        <span className="muted small">exp.</span>
                        <input
                          className="input"
                          inputMode="decimal"
                          placeholder="ajustar"
                          value={state.fixed[e.ref] ?? ""}
                          onChange={(ev) => set({ fixed: { ...state.fixed, [e.ref]: ev.target.value } })}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section>
              <h3>Correlación obtenida</h3>
              {!fit.ok ? (
                <div className="alert alert-warn">{fit.message}</div>
              ) : (
                <>
                  <div className="fit-equation">
                    <Sym s={dep.symbol} /> = {formatValue(fit.C, 4)}
                    {fit.groups.map((r, j) =>
                      r.exponent !== null && (r.status === "ajustado" || r.status === "fijo") ? (
                        <span key={r.key}>
                          {" "}· <Sym s={correlation.entries[j].g.symbol} />
                          <sup>{fmtExp(r.exponent)}</sup>
                        </span>
                      ) : null,
                    )}
                  </div>
                  <table className="fit-table">
                    <thead>
                      <tr>
                        <th>Parámetro</th>
                        <th>Valor</th>
                        <th>Intervalo 95 %</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>C</td>
                        <td className="num">{formatValue(fit.C, 4)}</td>
                        <td className="num">{fit.cCi95 ? `${formatValue(fit.cCi95[0], 3)} – ${formatValue(fit.cCi95[1], 3)}` : "—"}</td>
                      </tr>
                      {fit.groups.map((r, j) =>
                        r.exponent !== null ? (
                          <tr key={r.key}>
                            <td>
                              exponente de <Sym s={correlation.entries[j].g.symbol} />
                            </td>
                            <td className="num">{fmtExp(r.exponent)}</td>
                            <td className="num">{r.status === "fijo" ? "fijado" : r.ci95 !== null ? `± ${fmtExp(r.ci95)}` : "—"}</td>
                          </tr>
                        ) : null,
                      )}
                    </tbody>
                  </table>
                  <div className="fit-stats">
                    <span>
                      <strong>{fit.n}</strong> experimentos
                    </span>
                    <span title="Coeficiente de determinación en escala logarítmica">
                      R² = <strong>{fit.r2.toFixed(4)}</strong>
                    </span>
                    <span>
                      error medio <strong>{fit.mape.toFixed(1)} %</strong>
                    </span>
                    <span>
                      error máx. <strong>{fit.maxError.toFixed(1)} %</strong>
                    </span>
                  </div>
                  <p className="muted small">{quality(fit.r2, fit.mape)}</p>
                  {fit.message && <p className="alert alert-warn small">{fit.message}</p>}
                  {fit.dropped.length > 0 && (
                    <p className="muted small">
                      {fit.dropped.length} experimento(s) incompletos o con valores ≤ 0 no se usaron (filas atenuadas).
                    </p>
                  )}
                  {fit.groups.some((r) => r.ci95 !== null && r.exponent !== null && Math.abs(r.exponent) < r.ci95) && (
                    <p className="muted small">
                      Si el intervalo de un exponente incluye el 0, tus datos no muestran un efecto claro de ese grupo:
                      podrías excluirlo y volver a ajustar.
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          {fit.ok && <FitCharts correlation={correlation} />}
        </div>
      )}

      {pasteOpen && (
        <div className="modal-backdrop" onClick={() => setPasteOpen(false)}>
          <div className="modal" role="dialog" aria-label="Pegar datos" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>Pegar datos desde Excel</h3>
              <button className="icon-btn" onClick={() => setPasteOpen(false)} aria-label="Cerrar">
                ✕
              </button>
            </div>
            <p className="muted small">
              Copia las celdas en Excel o Google Sheets (incluye la fila de encabezados) y pégalas aquí. Los
              encabezados deben ser los símbolos de tus variables: {vars.map((v) => v.symbol).join(", ")}. Las
              unidades entre paréntesis se ignoran; los valores se interpretan en las unidades de la tabla de
              variables.
            </p>
            <textarea
              className="input paste-area"
              autoFocus
              value={pasteText}
              placeholder={`${vars.slice(0, 3).map((v) => v.symbol).join("\t")}\n…`}
              onChange={(e) => setPasteText(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn" onClick={() => setPasteOpen(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={!pasteText.trim()}
                onClick={() => {
                  importText(pasteText, "Datos pegados por el usuario.");
                  setPasteOpen(false);
                  setPasteText("");
                }}
              >
                Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function displayOf(v: ProcessVariable, row?: VariableRow): number {
  const u = row ? tryParseUnit(row.unit) : null;
  return u && v.valueSI != null ? (v.valueSI - u.offset) / u.factor : (v.valueSI ?? NaN);
}

function statusText(r: { status: string; exponent: number | null; ci95: number | null; collinearWith?: string[] }): string {
  switch (r.status) {
    case "ajustado":
      return r.exponent !== null ? `exponente ${fmtExp(r.exponent)}${r.ci95 !== null ? ` ± ${fmtExp(r.ci95)}` : ""}` : "se ajusta";
    case "fijo":
      return `exponente fijado en ${fmtExp(r.exponent ?? 0)}`;
    case "excluido":
      return "excluido del ajuste";
    case "constante":
      return "no cambió en tus experimentos: su efecto no se puede medir";
    case "colineal":
      return `cambió siempre junto con ${r.collinearWith?.join(", ") || "otros grupos"}: efectos inseparables`;
    default:
      return "";
  }
}

function quality(r2: number, mape: number): string {
  if (r2 > 0.99 && mape < 5) return "Ajuste excelente: la ley de potencias describe muy bien tus datos.";
  if (mape < 5 && r2 < 0.95)
    return `El error es pequeño (${mape.toFixed(1)} %). El R² sale bajo porque el grupo de interés casi no cambia en tus datos: en la práctica es una constante y los exponentes deberían salir cercanos a 0.`;
  if (r2 > 0.95) return "Buen ajuste. Revisa la gráfica de paridad para detectar puntos atípicos.";
  if (r2 > 0.8) return "Ajuste aceptable: puede faltar una variable o la ley de potencias no es la forma adecuada en todo el rango.";
  return "Ajuste pobre: revisa tus datos, las unidades o si falta alguna variable en el análisis.";
}

function FitCharts({ correlation }: { correlation: Correlation }) {
  const { fit, entries, dep, depValues } = correlation;
  const active = fit.groups
    .map((r, j) => ({ r, e: entries[j] }))
    .filter(({ r }) => r.exponent !== null && (r.status === "ajustado" || r.status === "fijo"));

  // Grupo principal para el eje x: el de mayor efecto (|a|·dispersión de ln Π)
  const spread = (vals: number[]) => {
    const l = fit.used.map((i) => Math.log(vals[i]));
    return Math.max(...l) - Math.min(...l);
  };
  const main = active.slice().sort((a, b) => Math.abs(b.r.exponent!) * spread(b.e.values) - Math.abs(a.r.exponent!) * spread(a.e.values))[0];

  const others = active.filter((a) => a !== main);
  const collapsePts = main
    ? fit.used.map((i) => {
        const corr = others.reduce((p, o) => p * Math.pow(o.e.values[i], o.r.exponent!), 1);
        return {
          x: main.e.values[i],
          y: depValues[i] / corr,
          info: [`Experimento ${i + 1}`, `${main.e.g.symbol} = ${formatValue(main.e.values[i])}`, `${dep.symbol} = ${formatValue(depValues[i])}`],
        };
      })
    : [];
  const parityPts = fit.used.map((i, k) => ({
    x: fit.observed[k],
    y: fit.predicted[k],
    info: [
      `Experimento ${i + 1}`,
      `medido: ${formatValue(fit.observed[k])}`,
      `predicho: ${formatValue(fit.predicted[k])}`,
      `error: ${((100 * (fit.predicted[k] - fit.observed[k])) / fit.observed[k]).toFixed(1)} %`,
    ],
  }));

  const yLabel = (
    <>
      <Sym s={dep.symbol} />
      {others.length > 0 && (
        <>
          {" / ("}
          {others.map((o, i) => (
            <span key={o.e.ref}>
              {i > 0 && "·"}
              <Sym s={o.e.g.symbol} />
              <sup>{fmtExp(o.r.exponent!)}</sup>
            </span>
          ))}
          {")"}
        </>
      )}
    </>
  );

  return (
    <div className="fit-charts">
      {main && (
        <figure>
          <figcaption>
            <strong>Colapso de datos.</strong> Si la correlación es correcta, todos los experimentos caen sobre una sola
            recta en escala log-log.
          </figcaption>
          <LogChart
            points={collapsePts}
            curve={(x) => fit.C * Math.pow(x, main.r.exponent!)}
            curveLabel="Correlación ajustada"
            xLabel={<Sym s={main.e.g.symbol} />}
            yLabel={yLabel}
            ariaLabel="Colapso de datos en escala logarítmica"
          />
        </figure>
      )}
      <figure>
        <figcaption>
          <strong>Paridad.</strong> Valor medido contra valor predicho por la correlación; las líneas punteadas marcan ±20 %.
        </figcaption>
        <LogChart
          points={parityPts}
          parity={20}
          xLabel={
            <>
              <Sym s={dep.symbol} /> medido
            </>
          }
          yLabel={
            <>
              <Sym s={dep.symbol} /> predicho
            </>
          }
          ariaLabel="Gráfica de paridad"
        />
      </figure>
      <p className="muted small">Pasa el cursor sobre los puntos para ver cada experimento.</p>
    </div>
  );
}
