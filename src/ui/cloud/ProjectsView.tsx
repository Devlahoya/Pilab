import { useCallback, useEffect, useState } from "react";
import { useCloud } from "../../cloud/CloudContext";
import { CloudDoc } from "../../cloud/types";
import { ShareDialog } from "./ShareDialog";

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ProjectsView({
  onOpen,
  onLogin,
  onGuide,
  refreshKey,
}: {
  onOpen: (d: CloudDoc) => void;
  onLogin: () => void;
  onGuide: () => void;
  refreshKey: number;
}) {
  const { backend, user, ready } = useCloud();
  const [docs, setDocs] = useState<CloudDoc[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState<CloudDoc | null>(null);
  const [filter, setFilter] = useState<"todos" | "analisis" | "simulacion">("todos");

  const load = useCallback(async () => {
    if (!backend || !user) return;
    setError(null);
    try {
      setDocs(await backend.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los proyectos.");
    }
  }, [backend, user]);

  useEffect(() => {
    setDocs(null);
    load();
  }, [load, refreshKey]);

  if (!ready) return <p className="muted">Conectando…</p>;

  if (!backend) {
    return (
      <div className="projects">
        <div className="empty-hero">
          <img src="/img/mascota1.jpg" alt="" className="empty-mascot" />
          <div>
            <h1>Mis proyectos</h1>
            <p>
              Muy pronto podrás crear una cuenta para guardar tus análisis y simulaciones en la nube, abrirlos desde cualquier
              dispositivo y compartirlos con un enlace.
            </p>
            <p>
              Mientras tanto, la app funciona completa: tu análisis se guarda automáticamente en este navegador y puedes
              descargarlo o abrirlo con <strong>«Guardar archivo»</strong> y <strong>«Abrir archivo»</strong> en la sección
              Análisis.
            </p>
            {import.meta.env.DEV && (
              <p className="alert alert-warn small">
                (Sólo en desarrollo) La nube no está configurada: faltan las variables VITE_FIREBASE_* en .env.local. Ver
                docs/FIREBASE.md, o abre la app con ?nube=demo para probar en modo demostración.
              </p>
            )}
            <button className="btn" onClick={onGuide}>
              Ver la guía de la app
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="projects">
        <div className="empty-hero">
          <img src="/img/mascota1.jpg" alt="" className="empty-mascot" />
          <div>
            <h1>Mis proyectos en la nube</h1>
            <p>Inicia sesión para guardar tus análisis y simulaciones, abrirlos desde cualquier dispositivo y compartirlos con tu asesor.</p>
            <button className="btn btn-primary btn-lg" onClick={onLogin}>
              Entrar o crear cuenta
            </button>
          </div>
        </div>
      </div>
    );
  }

  const shown = (docs ?? []).filter((d) => filter === "todos" || d.kind === filter);

  const remove = async (d: CloudDoc) => {
    if (!window.confirm(`¿Eliminar «${d.title}» de la nube? Esta acción no se puede deshacer.`)) return;
    try {
      await backend.remove(d.id);
      setDocs((cur) => (cur ?? []).filter((x) => x.id !== d.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const duplicate = async (d: CloudDoc) => {
    try {
      const copy = await backend.save({ title: `Copia de ${d.title}`, kind: d.kind, payload: d.payload });
      setDocs((cur) => [copy, ...(cur ?? [])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo duplicar.");
    }
  };

  return (
    <div className="projects">
      <header className="projects-head">
        <div>
          <h1>Mis proyectos</h1>
          <p className="muted">
            Guardados en la nube{backend.name !== "Firebase" ? ` (${backend.name})` : ""}. Para agregar uno, usa «☁ Guardar en la
            nube» en un análisis o en el simulador.
          </p>
        </div>
        <div className="seg">
          {(["todos", "analisis", "simulacion"] as const).map((f) => (
            <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
              {f === "todos" ? "Todos" : f === "analisis" ? "Análisis" : "Simulaciones"}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="alert alert-error">{error}</p>}
      {docs === null ? (
        <p className="muted">Cargando…</p>
      ) : shown.length === 0 ? (
        <div className="empty">
          <p>
            {docs.length === 0
              ? "Todavía no tienes proyectos guardados. Abre una plantilla o el simulador y presiona «☁ Guardar en la nube»."
              : "No hay proyectos de este tipo."}
          </p>
        </div>
      ) : (
        <ul className="project-list">
          {shown.map((d) => (
            <li key={d.id} className="project-card">
              <button className="project-main" onClick={() => onOpen(d)}>
                <span className={`project-kind kind-${d.kind}`} aria-hidden>
                  {d.kind === "analisis" ? "Π" : "⚗"}
                </span>
                <span className="project-text">
                  <span className="project-title">{d.title}</span>
                  <span className="muted small">
                    {d.kind === "analisis" ? "Análisis dimensional" : "Simulación de biorreactor"} · {fmtDate(d.updatedAt)}
                  </span>
                </span>
                {d.isPublic && <span className="tag tag-ok">compartido</span>}
              </button>
              <div className="project-actions">
                <button className="btn btn-sm btn-primary" onClick={() => onOpen(d)}>
                  Abrir
                </button>
                <button className="btn btn-sm" onClick={() => setSharing(d)}>
                  Compartir
                </button>
                <button className="btn btn-sm" onClick={() => duplicate(d)}>
                  Duplicar
                </button>
                <button className="btn btn-sm btn-ghost danger-text" onClick={() => remove(d)}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sharing && (
        <ShareDialog
          doc={sharing}
          onClose={() => setSharing(null)}
          onChanged={(nd) => setDocs((cur) => (cur ?? []).map((x) => (x.id === nd.id ? nd : x)))}
        />
      )}
    </div>
  );
}
