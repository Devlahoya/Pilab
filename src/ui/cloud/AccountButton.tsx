import { useEffect, useRef, useState } from "react";
import { useCloud } from "../../cloud/CloudContext";
import { AVATARS } from "../../cloud/types";

export function AccountButton({
  onLogin,
  onProfile,
  onProjects,
}: {
  onLogin: () => void;
  onProfile: () => void;
  onProjects: () => void;
}) {
  const { backend, user, ready } = useCloud();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!backend || !ready) return null;
  if (!user) {
    return (
      <button className="btn btn-sm account-login" onClick={onLogin}>
        Entrar
      </button>
    );
  }
  const av = AVATARS.find((a) => a.id === user.avatar) ?? AVATARS[0];
  return (
    <div className="account" ref={ref}>
      <button className="account-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <img src={av.face} alt="" width={32} height={32} />
        <span className="account-name">{user.name}</span>
      </button>
      {open && (
        <div className="account-menu" role="menu">
          <div className="account-head">
            <img src={av.face} alt="" width={44} height={44} />
            <div>
              <strong>{user.name}</strong>
              <span className="muted small">{user.email}</span>
            </div>
          </div>
          <button role="menuitem" onClick={() => { setOpen(false); onProjects(); }}>
            ☁ Mis proyectos
          </button>
          <button role="menuitem" onClick={() => { setOpen(false); onProfile(); }}>
            ✎ Editar perfil y avatar
          </button>
          <button role="menuitem" onClick={() => { setOpen(false); backend.signOut(); }}>
            ⎋ Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
