import { KIND_BY_ID } from "../core";
import { AUTHOR, INSTITUTION, PROGRAM } from "../brand";
import { PROCESS_AREAS, ProcessTemplate, TEMPLATES } from "../processes/templates";
import { MathText } from "./Math";
import { ProcessDiagram, labelsFrom } from "./diagrams";

const templateLabels = (t: ProcessTemplate) =>
  labelsFrom(t.variables.map((v) => ({ kindId: v.kind, symbol: v.symbol ?? KIND_BY_ID[v.kind]?.symbol ?? "" })));

export function TemplateGallery({
  onPick,
  onBlank,
  onGuide,
}: {
  onPick: (t: ProcessTemplate) => void;
  onBlank: () => void;
  onGuide: () => void;
}) {
  return (
    <div className="gallery">
      <header className="gallery-hero">
        <div className="hero-text">
          <p className="hero-credit">
            <strong>PiLab</strong> · Análisis adimensional, similitud y control de procesos
            <br />
            Desarrollado por <strong>{AUTHOR}</strong> · {PROGRAM}, {INSTITUTION}
          </p>
          <h1>¿Qué proceso quieres analizar?</h1>
          <p>
            Elige una plantilla para empezar con las variables típicas y valores de ejemplo, o arma tu propio
            análisis desde cero. Todo se puede editar después.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary btn-lg" onClick={onBlank}>
              ＋ Empezar desde cero
            </button>
            <button className="btn btn-lg" onClick={onGuide}>
              ¿Cómo funciona?
            </button>
          </div>
        </div>
        <img src="/img/mascota1.jpg" alt="" className="hero-mascot hero-mascot-lg" width={200} height={300} />
      </header>

      {PROCESS_AREAS.map((area) => {
        const items = TEMPLATES.filter((t) => t.area === area);
        if (!items.length) return null;
        return (
          <section key={area} className="gallery-section">
            <h2>{area}</h2>
            <div className="card-grid">
              {items.map((t) => (
                <button key={t.id} className="template-card" onClick={() => onPick(t)}>
                  <span className="template-thumb" aria-hidden>
                    <ProcessDiagram templateId={t.id} L={templateLabels(t)} compact />
                  </span>
                  <span className="template-body">
                    <span className="template-name">{t.name}</span>
                    <span className="template-desc">{t.description}</span>
                    <span className="template-expected">
                      <MathText text={t.expected} />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
