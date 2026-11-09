import { AnalysisResult, BASE_DIMENSIONS, Fraction, ProcessVariable, isDimensionless, piLabel } from "../core";
import { GroupFormula, Sym } from "./Math";

interface Props {
  vars: ProcessVariable[];
  analysis: AnalysisResult;
  manualRepeating: string[];
  onToggleRepeating: (id: string) => void;
  onAutoRepeating: () => void;
}

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const fmtCoef = (x: number) => (Number.isInteger(x) ? String(x) : Fraction.from(x).toString());

export function ProcedurePanel({ vars, analysis, manualRepeating, onToggleRepeating, onAutoRepeating }: Props) {
  const { matrix, activeDims, rank, k, repeatingIds, groups } = analysis;
  const auto = manualRepeating.length === 0;
  const repIdx = repeatingIds.map((id) => vars.findIndex((v) => v.id === id));

  if (vars.length === 0) return <p className="muted">Agrega variables para ver el procedimiento.</p>;

  return (
    <div className="procedure">
      <section>
        <h3>1. Matriz dimensional</h3>
        <p className="muted small">
          Cada columna es una variable y cada fila el exponente de una dimensión fundamental. Su rango r es el número
          de dimensiones independientes.
        </p>
        <div className="table-scroll">
          <table className="dim-matrix">
            <thead>
              <tr>
                <th />
                {vars.map((v) => (
                  <th key={v.id} className={repeatingIds.includes(v.id) ? "is-rep" : ""}>
                    <Sym s={v.symbol} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeDims.map((d, row) => (
                <tr key={d}>
                  <th title={BASE_DIMENSIONS[d].name}>{BASE_DIMENSIONS[d].key}</th>
                  {matrix[row].map((x, j) => (
                    <td key={j} className={`${x === 0 ? "zero" : ""} ${repeatingIds.includes(vars[j].id) ? "is-rep" : ""}`}>
                      {fmtCoef(x)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          n = {vars.length}, r = {rank} ⇒ k = n − r = <strong>{k}</strong> grupos adimensionales.
        </p>
      </section>

      <section>
        <h3>2. Variables repetidas</h3>
        <p className="muted small">
          Se eligen r = {rank} variables con dimensiones independientes que aparecerán en todos los grupos. Suelen
          escogerse una geométrica, una cinemática y una dinámica (p. ej. D, N y ρ), y nunca la variable de interés.
        </p>
        <div className="chip-row">
          <button className={`chip ${auto ? "chip-on" : ""}`} onClick={onAutoRepeating}>
            Automático
          </button>
          {vars.map((v) => {
            const on = repeatingIds.includes(v.id);
            return (
              <button
                key={v.id}
                className={`chip ${on ? "chip-on" : ""}`}
                disabled={isDimensionless(v.dims)}
                onClick={() => onToggleRepeating(v.id)}
                title={isDimensionless(v.dims) ? "Una variable adimensional no puede ser repetida" : v.name}
              >
                <Sym s={v.symbol} />
              </button>
            );
          })}
        </div>
        {!analysis.repeatingValid && (
          <p className="alert alert-error">
            {analysis.warnings.find((w) => w.message.includes("repetidas"))?.message ?? "Selección no válida."}
          </p>
        )}
      </section>

      {analysis.repeatingValid && groups.length > 0 && (
        <section>
          <h3>3. Construcción de cada grupo</h3>
          <p className="muted small">
            Para cada variable no repetida q se busca Π = q · R₁ᵃ · R₂ᵇ · … sin dimensiones: la suma de exponentes de
            cada dimensión debe ser cero.
          </p>
          <ol className="pi-steps">
            {groups.map((g, gi) => {
              const qIdx = vars.findIndex((v) => v.id === g.sourceId);
              const q = vars[qIdx];
              const raw = g.rawExponents!;
              return (
                <li key={gi} className="pi-step">
                  <div className="pi-step-head">
                    <strong>{piLabel(gi + 1)}</strong> =&nbsp;
                    <Sym s={q.symbol} />
                    {repIdx.map((ri, i) => (
                      <span key={ri}>
                        {" "}· <Sym s={vars[ri].symbol} />
                        <sup>{LETTERS[i]}</sup>
                      </span>
                    ))}
                  </div>
                  <div className="pi-eqs">
                    {activeDims.map((d, row) => {
                      const terms: string[] = [];
                      const cq = matrix[row][qIdx];
                      if (cq !== 0) terms.push(fmtCoef(cq));
                      repIdx.forEach((ri, i) => {
                        const c = matrix[row][ri];
                        if (c === 0) return;
                        const coef = c === 1 ? "" : c === -1 ? "−" : fmtCoef(c);
                        terms.push(`${coef}${LETTERS[i]}`);
                      });
                      if (!terms.length) return null;
                      const text = terms.join(" + ").replace(/\+ −/g, "− ").replace(/\+ -/g, "− ");
                      return (
                        <code key={d}>
                          {BASE_DIMENSIONS[d].key}: {text} = 0
                        </code>
                      );
                    })}
                  </div>
                  <div className="pi-solution">
                    {repIdx.map((ri, i) => (
                      <span key={ri} className="pi-sol">
                        {LETTERS[i]} = {raw[ri].toString()}
                      </span>
                    ))}
                  </div>
                  <div className="pi-result">
                    ⇒ {piLabel(gi + 1)} = <GroupFormula vars={vars} exponents={g.exponents} />
                    {!raw.every((x) => x.isInteger()) && (
                      <span className="muted small"> (elevado a una potencia entera para quitar fracciones)</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}
