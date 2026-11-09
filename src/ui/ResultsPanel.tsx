import { useState } from "react";
import {
  AnalysisResult,
  NUMBER_BY_ID,
  NamedGroup,
  ProcessVariable,
  Relation,
  evaluateGroup,
  groupToLatex,
  groupToText,
} from "../core";
import { formatValue } from "./format";
import { GroupFormula, Sym } from "./Math";

interface Props {
  vars: ProcessVariable[];
  analysis: AnalysisResult;
  relation: Relation;
  dependentId?: string;
  pinned: string[];
  onPin: (key: string) => void;
  onUnpin: (key: string) => void;
  onResetPins: () => void;
}

const SOURCE_LABEL: Record<NamedGroup["source"], string> = {
  biblioteca: "Número conocido",
  relación: "Relación de semejanza",
  adimensional: "Variable adimensional",
  clásico: "Grupo sin nombre común",
};

export function ResultsPanel({ vars, analysis, relation, dependentId, pinned, onPin, onUnpin, onResetPins }: Props) {
  const { n, rank, k } = analysis;
  const errors = analysis.warnings.filter((w) => w.level === "error");
  const notices = analysis.warnings.filter((w) => w.level === "aviso");
  const used = new Set([relation.dependent, ...relation.independents].filter(Boolean).map((g) => g!.key));
  const others = relation.available.filter((g) => !used.has(g.key));

  if (n === 0) {
    return (
      <div className="results empty">
        <p>Cuando agregues variables, aquí aparecerán los grupos adimensionales.</p>
      </div>
    );
  }

  return (
    <div className="results">
      <div className="stats">
        <Stat label="variables" value={n} hint="n" />
        <span className="stat-op">−</span>
        <Stat label="dimensiones independientes" value={rank} hint="r (rango)" />
        <span className="stat-op">=</span>
        <Stat label="grupos adimensionales" value={Math.max(k, 0)} hint="k = n − r" strong />
      </div>

      {errors.map((w, i) => (
        <div key={`e${i}`} className="alert alert-error">
          {w.message}
        </div>
      ))}

      {k > 0 && (relation.dependent || relation.independents.length > 0) && (
        <div className="relation" aria-label="Relación adimensional">
          {relation.dependent ? (
            <>
              <span className="rel-dep">
                <Sym s={relation.dependent.symbol} />
              </span>
              <span className="rel-eq">=</span>
              <span className="rel-f">f</span>
              <span className="rel-paren">(</span>
              {relation.independents.map((g, i) => (
                <span key={g.key}>
                  {i > 0 && <span className="rel-comma">, </span>}
                  <Sym s={g.symbol} />
                </span>
              ))}
              {relation.independents.length === 0 && <span className="muted"> constante </span>}
              <span className="rel-paren">)</span>
            </>
          ) : (
            <>
              <span className="rel-f">F</span>
              <span className="rel-paren">(</span>
              {relation.independents.map((g, i) => (
                <span key={g.key}>
                  {i > 0 && <span className="rel-comma">, </span>}
                  <Sym s={g.symbol} />
                </span>
              ))}
              <span className="rel-paren">) = 0</span>
            </>
          )}
        </div>
      )}

      {!dependentId && k > 0 && (
        <p className="muted small">
          Consejo: marca con ● la <strong>variable de interés</strong> (la que quieres predecir) para obtener la
          relación en la forma Π = f(…).
        </p>
      )}
      {relation.dependent && relation.independents.length === 0 && (
        <p className="muted small">
          Sólo hay un grupo: el análisis predice que <Sym s={relation.dependent.symbol} /> es una constante, que se
          determina experimentalmente.
        </p>
      )}

      {notices.map((w, i) => (
        <div key={`n${i}`} className="alert alert-warn">
          {w.message}
        </div>
      ))}

      <div className="group-list">
        {relation.dependent && (
          <GroupCard g={relation.dependent} vars={vars} role="interés" pinned={pinned.includes(relation.dependent.key)} onUnpin={onUnpin} />
        )}
        {relation.independents.map((g) => (
          <GroupCard key={g.key} g={g} vars={vars} pinned={pinned.includes(g.key)} onUnpin={onUnpin} />
        ))}
      </div>

      {others.length > 0 && (
        <details className="others">
          <summary>
            Otros números que se pueden formar con tus variables <span className="badge">{others.length}</span>
          </summary>
          <p className="muted small">
            Cualquier conjunto de {k} grupos independientes es igual de válido. Elige «Usar» para incluir un número en la
            relación; la app ajusta los demás para que sigan siendo independientes.
          </p>
          <ul className="others-list">
            {others.map((g) => (
              <li key={g.key}>
                <span className="others-sym">
                  <Sym s={g.symbol} />
                  {g.variant && <span className="muted small"> ({g.variant})</span>}
                </span>
                <span className="others-formula">
                  <GroupFormula vars={vars} exponents={g.exponents} termOrder={g.termOrder} />
                </span>
                <span className="others-name muted small">{g.name}</span>
                <button className="btn btn-sm" onClick={() => onPin(g.key)}>
                  Usar
                </button>
              </li>
            ))}
          </ul>
          {pinned.length > 0 && (
            <button className="btn btn-sm btn-ghost" onClick={onResetPins}>
              Restablecer selección automática
            </button>
          )}
        </details>
      )}
    </div>
  );
}

function Stat({ label, value, hint, strong }: { label: string; value: number; hint: string; strong?: boolean }) {
  return (
    <div className={`stat ${strong ? "stat-strong" : ""}`}>
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
      <span className="stat-hint">{hint}</span>
    </div>
  );
}

function GroupCard({
  g,
  vars,
  role,
  pinned,
  onUnpin,
}: {
  g: NamedGroup;
  vars: ProcessVariable[];
  role?: string;
  pinned: boolean;
  onUnpin: (key: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const lib = g.numberId ? NUMBER_BY_ID[g.numberId] : undefined;
  const value = evaluateGroup(vars, g.exponents);
  const regime = value !== null && lib?.interpret ? lib.interpret(value) : null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${g.symbol} = ${groupToLatex(vars, g.exponents, g.termOrder)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* portapapeles no disponible */
    }
  };

  return (
    <article className={`group-card ${role ? "group-dep" : ""}`}>
      <header className="group-head">
        <span className="group-symbol">
          <Sym s={g.symbol} />
        </span>
        <span className="group-eq">=</span>
        <GroupFormula vars={vars} exponents={g.exponents} termOrder={g.termOrder} />
        {value !== null && (
          <span className="group-value" title={`${g.symbol} ≈ ${value}`}>
            ≈ {formatValue(value)}
          </span>
        )}
      </header>
      <div className="group-meta">
        <span className="group-name">{lib ? lib.name : g.name}</span>
        <span className="tag">{role ? "variable de interés" : SOURCE_LABEL[g.source]}</span>
        {pinned && (
          <button className="tag tag-pin" onClick={() => onUnpin(g.key)} title="Quitar de la selección manual">
            📌 fijado ✕
          </button>
        )}
        {regime && <span className={`tag tag-${regime.tone}`}>{regime.label}</span>}
      </div>
      {lib && <p className="group-meaning">{lib.meaning}</p>}
      {lib?.notes && <p className="group-notes">{lib.notes}</p>}
      {g.source === "clásico" && (
        <p className="group-notes">
          Grupo obtenido por el método de variables repetidas. Puedes multiplicarlo o elevarlo a cualquier potencia
          por otros grupos y sigue siendo válido.
        </p>
      )}
      <footer className="group-foot">
        <code className="group-text">{groupToText(vars, g.exponents, g.termOrder)}</code>
        <button className="btn btn-sm btn-ghost" onClick={copy}>
          {copied ? "¡Copiado!" : "Copiar LaTeX"}
        </button>
      </footer>
    </article>
  );
}
