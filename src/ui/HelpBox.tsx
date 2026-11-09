import { useState } from "react";
import { WHAT_IF, WHAT_IF_GENERIC } from "../processes/templates";

const KEY = "pilab.help.dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** Bienvenida con los pasos básicos; se puede cerrar. */
export function WelcomeBanner({ onGuide }: { onGuide: () => void }) {
  const [hidden, setHidden] = useState(readDismissed);
  if (hidden) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* sin almacenamiento */
    }
  };
  return (
    <div className="welcome" role="note">
      <div className="welcome-steps">
        <div>
          <span className="step">1</span>
          <p>
            <strong>Lista las variables</strong> que influyen en el proceso. Agrega o quita para probar tus hipótesis.
          </p>
        </div>
        <div>
          <span className="step">2</span>
          <p>
            <strong>Marca con ●</strong> la que quieres predecir.
          </p>
        </div>
        <div>
          <span className="step">3</span>
          <p>
            <strong>Lee la relación</strong> adimensional y úsala para <strong>escalar</strong> el proceso.
          </p>
        </div>
      </div>
      <div className="welcome-actions">
        <button className="btn btn-sm" onClick={onGuide}>
          Ver guía completa
        </button>
        <button className="icon-btn" onClick={close} aria-label="Cerrar bienvenida" title="No volver a mostrar">
          ✕
        </button>
      </div>
    </div>
  );
}

/** Explicación plegable de por qué agregar o quitar variables, con ejemplos del proceso actual. */
export function WhatIfBox({ templateId }: { templateId?: string }) {
  const examples = (templateId && WHAT_IF[templateId]) || [];
  return (
    <details className="whatif-box">
      <summary>¿Para qué agrego o quito variables?</summary>
      <p>
        La lista es tu <strong>hipótesis</strong> de qué influye en el fenómeno. Al cambiarla, la app recalcula los
        grupos al instante y te avisa cuáles aparecen o desaparecen.
      </p>
      <ul>
        {[...examples, ...WHAT_IF_GENERIC].map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </details>
  );
}
