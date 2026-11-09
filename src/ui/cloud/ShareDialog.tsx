import { useEffect, useState } from "react";
import { useCloud } from "../../cloud/CloudContext";
import { CloudDoc } from "../../cloud/types";

export const shareUrl = (id: string) => `${window.location.origin}${window.location.pathname}?ver=${encodeURIComponent(id)}`;

export function ShareDialog({ doc, onClose, onChanged }: { doc: CloudDoc; onClose: () => void; onChanged: (d: CloudDoc) => void }) {
  const { backend } = useCloud();
  const [isPublic, setIsPublic] = useState(doc.isPublic);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const url = shareUrl(doc.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = async () => {
    if (!backend) return;
    setBusy(true);
    setError(null);
    try {
      await backend.setPublic(doc.id, !isPublic);
      setIsPublic(!isPublic);
      onChanged({ ...doc, isPublic: !isPublic });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sin portapapeles */
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal share-modal" role="dialog" aria-label="Compartir proyecto" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Compartir «{doc.title}»</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <label className="switch-row">
          <input type="checkbox" checked={isPublic} onChange={toggle} disabled={busy} />
          <span>
            <strong>Cualquier persona con el enlace puede verlo</strong>
            <span className="muted small">
              Quien lo abra recibe una <em>copia</em> para explorar: sus cambios no modifican tu proyecto.
            </span>
          </span>
        </label>
        {isPublic ? (
          <div className="share-link">
            <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Enlace para compartir" />
            <button className="btn btn-primary" onClick={copy}>
              {copied ? "¡Copiado!" : "Copiar enlace"}
            </button>
          </div>
        ) : (
          <p className="muted small">El proyecto es privado: sólo tú puedes verlo.</p>
        )}
        {error && <p className="alert alert-error small">{error}</p>}
      </div>
    </div>
  );
}
