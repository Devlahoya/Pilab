import { FormEvent, useEffect, useState } from "react";
import { useCloud } from "../../cloud/CloudContext";
import { AVATARS, AvatarId } from "../../cloud/types";

type Mode = "entrar" | "crear" | "recuperar" | "perfil";

export function AvatarPicker({ value, onChange }: { value: AvatarId; onChange: (a: AvatarId) => void }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Elige tu avatar">
      {AVATARS.map((a) => (
        <button
          type="button"
          key={a.id}
          role="radio"
          aria-checked={value === a.id}
          className={`avatar-opt ${value === a.id ? "on" : ""}`}
          onClick={() => onChange(a.id)}
          title={a.label}
        >
          <img src={a.face} alt={`Avatar ${a.label}`} width={64} height={64} />
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

export function AuthDialog({ initial = "entrar", onClose }: { initial?: Mode; onClose: () => void }) {
  const { backend, user } = useCloud();
  const [mode, setMode] = useState<Mode>(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const [avatar, setAvatar] = useState<AvatarId>(user?.avatar ?? 1);
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
                <AvatarPicker value={avatar} onChange={setAvatar} />
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
