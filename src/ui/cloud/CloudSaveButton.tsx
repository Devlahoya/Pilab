import { useState } from "react";
import { useCloud } from "../../cloud/CloudContext";
import { CloudDoc, DocKind } from "../../cloud/types";
import { ShareDialog } from "./ShareDialog";

interface Props {
  kind: DocKind;
  title: string;
  /** Contenido actual serializado. */
  payload: string;
  cloudId?: string;
  /** Contenido tal como se guardó por última vez (para saber si hay cambios). */
  savedPayload?: string;
  onSaved: (doc: CloudDoc, payload: string) => void;
  onNeedLogin: () => void;
  notify: (msg: string) => void;
}

/** Botón «Guardar en la nube» + «Compartir», con indicador de cambios sin guardar. */
export function CloudSaveButton({ kind, title, payload, cloudId, savedPayload, onSaved, onNeedLogin, notify }: Props) {
  const { backend, user } = useCloud();
  const [busy, setBusy] = useState(false);
  const [shareDoc, setShareDoc] = useState<CloudDoc | null>(null);
  if (!backend) return null;

  const dirty = !cloudId || savedPayload !== payload;

  const save = async () => {
    if (!user) {
      onNeedLogin();
      return;
    }
    setBusy(true);
    try {
      let doc: CloudDoc;
      try {
        doc = await backend.save({ id: cloudId, title: title.trim() || "Sin título", kind, payload });
      } catch (e) {
        // Si el proyecto era de otra cuenta, se guarda como uno nuevo
        if (!cloudId) throw e;
        doc = await backend.save({ title: title.trim() || "Sin título", kind, payload });
      }
      onSaved(doc, payload);
      notify(cloudId === doc.id ? "Cambios guardados en la nube." : "Guardado en «Mis proyectos».");
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!cloudId) return;
    try {
      const d = await backend.get(cloudId);
      if (d) setShareDoc(d);
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo abrir.");
    }
  };

  return (
    <>
      <button className={`btn btn-sm ${dirty ? "btn-primary" : ""}`} onClick={save} disabled={busy} title={user ? "" : "Inicia sesión para guardar en la nube"}>
        {busy ? "Guardando…" : dirty ? "☁ Guardar en la nube" : "✓ Guardado"}
      </button>
      {cloudId && user && (
        <button className="btn btn-sm" onClick={share}>
          Compartir
        </button>
      )}
      {shareDoc && <ShareDialog doc={shareDoc} onClose={() => setShareDoc(null)} onChanged={setShareDoc} />}
    </>
  );
}
