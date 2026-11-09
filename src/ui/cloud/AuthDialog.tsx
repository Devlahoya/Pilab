import { FormEvent, useEffect, useState } from "react";
import { useCloud } from "../../cloud/CloudContext";
import { AvatarId } from "../../cloud/types";
import { Avatar, AvatarGroup, DEFAULT_AVATAR, EMBLEMS, INITIALS, MASCOTS, avatarGroup, avatarLabel } from "../avatars";

type Mode = "entrar" | "crear" | "recuperar" | "perfil";

const GROUPS: { id: AvatarGroup; label: string; ids: string[] }[] = [
  { id: "personaje", label: "Personaje", ids: MASCOTS.map((m) => m.id) },
  { id: "ciencia", label: "Ciencia", ids: EMBLEMS.map((e) => e.id) },
  { id: "iniciales", label: "Iniciales", ids: INITIALS.map((i) => i.id) },
];

export function AvatarPicker({ value, onChange, name }: { value: AvatarId; onChange: (a: AvatarId) => void; name: string }) {
  const [group, setGroup] = useState<AvatarGroup>(() => avatarGroup(value));
  const ids = GROUPS.find((g) => g.id === group)!.ids;
  const displayName = name.trim() || "Tu nombre";
  return (
    <div className="avatar-picker">
      <div className="avatar-preview" aria-live="polite">
        <Avatar id={value} name={displayName} size={64} />
        <div>
          <span className="muted small">Así te verán</span>
          <strong>{displayName}</strong>
          <span className="muted small">{avatarLabel(value)}</span>
        </div>
      </div>
      <div className="seg avatar-tabs" role="tablist" aria-label="Tipo de avatar">
        {GROUPS.map((g) => (
          <button type="button" key={g.id} role="tab" aria-selected={group === g.id} className={group === g.id ? "on" : ""} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className={`avatar-grid avatar-grid-${group}`} role="radiogroup" aria-label="Elige tu avatar">
        {ids.map((id) => (
          <button
            type="button"
            key={id}
            role="radio"
            aria-checked={value === id}
            aria-label={avatarLabel(id)}
            title={avatarLabel(id)}
            className={`avatar-opt ${value === id ? "on" : ""}`}
            onClick={() => onChange(id)}
          >
            <Avatar id={id} name={displayName} size={group === "personaje" ? 72 : 48} />
            {group === "personaje" && <span>{avatarLabel(id)}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AuthDialog({ initial = "entrar", onClose }: { initial?: Mode; onClose: () => void }) {
  const { backend, user } = useCloud();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(user?.avatar ?? DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Al iniciar sesión o crear cuenta, se cierra solo
  useEffect(() => {
    if (user && (mode === "entrar" || mode === "crear") && !busy) onClose();
  }, [user, mode, busy, onClose]);

  if (!backend) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      if (mode === "entrar") await backend.signIn(email, password);
      if (mode === "crear") {
        if (!name.trim()) throw new Error("Escribe tu nombre.");
        await backend.signUp(email, password, name.trim(), avatar);
      }
      if (mode === "recuperar") {
        await backend.resetPassword(email);
        setInfo("Te enviamos un correo para restablecer tu contraseña. Revisa también la carpeta de spam.");
      }
      if (mode === "perfil") {
        await backend.updateProfile(name.trim() || "Usuario", avatar);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error.");
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    entrar: "Inicia sesión",
    crear: "Crea tu cuenta",
    recuperar: "Recupera tu contraseña",
    perfil: "Tu perfil",
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" role="dialog" aria-label={titles[mode]} onClick={(e) => e.stopPropagation()}>
        <div className="auth-side" aria-hidden>
          <img src="/img/mascota3.jpg" alt="" className="auth-mascot" />
        </div>
        <form className="auth-form" onSubmit={submit}>
          <div className="auth-logos">
            <img src="/img/itd.png" alt="Instituto Tecnológico de Durango" height={44} />
            <img src="/img/mcibq.jpg" alt="Maestría en Ciencias en Ingeniería Bioquímica" height={44} />
            <button type="button" className="icon-btn auth-close" onClick={onClose} aria-label="Cerrar">
              ✕
            </button>
          </div>
          <h3>{titles[mode]}</h3>
          {mode !== "perfil" && (
            <p className="muted small">
              {mode === "crear"
                ? "Con una cuenta guardas tus análisis y simulaciones en la nube y los compartes con un enlace."
                : mode === "recuperar"
                  ? "Escribe tu correo y te mandamos un enlace para crear una contraseña nueva."
                  : "Entra para ver tus proyectos guardados desde cualquier computadora o celular."}
            </p>
          )}
          {backend.name !== "Firebase" && (
            <p className="alert alert-warn small">Modo demostración: las cuentas y proyectos se guardan sólo en este navegador.</p>
          )}

          {(mode === "crear" || mode === "perfil") && (
            <>
              <label className="field-col">
                <span>Nombre</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required />
              </label>
              <div className="field-col">
                <span>Avatar</span>
                <AvatarPicker value={avatar} onChange={setAvatar} name={name} />
              </div>
            </>
          )}
          {mode !== "perfil" && (
            <label className="field-col">
              <span>Correo</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
            </label>
          )}
          {(mode === "entrar" || mode === "crear") && (
            <label className="field-col">
              <span>Contraseña {mode === "crear" && <small className="muted">(mínimo 6 caracteres)</small>}</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "crear" ? "new-password" : "current-password"}
                minLength={6}
                required
              />
            </label>
          )}

          {error && <p className="alert alert-error small">{error}</p>}
          {info && <p className="alert alert-ok small">{info}</p>}

          <button className="btn btn-primary btn-lg auth-submit" disabled={busy}>
            {busy ? "Un momento…" : mode === "entrar" ? "Entrar" : mode === "crear" ? "Crear cuenta" : mode === "recuperar" ? "Enviar correo" : "Guardar perfil"}
          </button>

          <div className="auth-links">
            {mode === "entrar" && (
              <>
                <button type="button" className="link" onClick={() => setMode("crear")}>
                  ¿No tienes cuenta? Crea una
                </button>
                <button type="button" className="link" onClick={() => setMode("recuperar")}>
                  Olvidé mi contraseña
                </button>
              </>
            )}
            {(mode === "crear" || mode === "recuperar") && (
              <button type="button" className="link" onClick={() => setMode("entrar")}>
                Ya tengo cuenta: iniciar sesión
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
