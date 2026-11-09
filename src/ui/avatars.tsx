/**
 * Catálogo de avatares de perfil.
 *
 * Se guardan como texto (p. ej. "m2", "e-dna", "ini-violet"). Los perfiles
 * antiguos guardaron 1, 2 o 3 (las poses de la mascota): se convierten solos.
 */
import { ReactNode } from "react";

export type AvatarGroup = "personaje" | "ciencia" | "iniciales";

interface MascotDef {
  id: string;
  label: string;
  src: string;
}

interface EmblemDef {
  id: string;
  label: string;
  /** Degradado de fondo (dos colores). */
  from: string;
  to: string;
  icon: ReactNode;
}

interface InitialsDef {
  id: string;
  label: string;
  from: string;
  to: string;
}

export const MASCOTS: MascotDef[] = [
  { id: "m1", label: "Laboratorio", src: "/img/avatar1.jpg" },
  { id: "m2", label: "Biorreactor", src: "/img/avatar2.jpg" },
  { id: "m3", label: "Diseño", src: "/img/avatar3.jpg" },
];

const S = { fill: "none", stroke: "#fff", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const EMBLEMS: EmblemDef[] = [
  {
    id: "e-flask", label: "Matraz", from: "#14b8a6", to: "#0f766e",
    icon: (
      <g {...S}>
        <path d="M9.5 3.5h5M10.5 3.5v5.2L5.6 17.4a2 2 0 0 0 1.8 3h9.2a2 2 0 0 0 1.8-3l-4.9-8.7V3.5" />
        <path d="M7.6 15h8.8" />
        <circle cx="10.5" cy="17.6" r=".7" fill="#fff" />
        <circle cx="13.6" cy="18.3" r=".5" fill="#fff" />
      </g>
    ),
  },
  {
    id: "e-reactor", label: "Biorreactor", from: "#6366f1", to: "#4338ca",
    icon: (
      <g {...S}>
        <path d="M7 7.5h10v11a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 18.5z" />
        <path d="M12 3v13M9.5 3h5M9.3 16h5.4" />
        <path d="M7 11.5h10" strokeDasharray="1.6 1.6" />
      </g>
    ),
  },
  {
    id: "e-dna", label: "ADN", from: "#ec4899", to: "#be185d",
    icon: (
      <g {...S}>
        <path d="M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9" />
        <path d="M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9" />
        <path d="M9.2 6h5.6M9.2 18h5.6M10.3 12h3.4" />
      </g>
    ),
  },
  {
    id: "e-microscope", label: "Microscopio", from: "#0ea5e9", to: "#0369a1",
    icon: (
      <g {...S}>
        <path d="M5 21h14M8 18h7" />
        <path d="M10 4.5l2.6-1.5 3.5 6-2.6 1.5z" />
        <path d="M12.6 10.5A5 5 0 0 1 15 18" />
        <path d="M9.5 13.5h3" />
      </g>
    ),
  },
  {
    id: "e-cell", label: "Célula", from: "#22c55e", to: "#15803d",
    icon: (
      <g {...S}>
        <path d="M12 3.5c5 0 8.5 3.6 8.5 8.3S17 20.5 12 20.5 3.5 16.6 3.5 11.8 7 3.5 12 3.5z" />
        <circle cx="13" cy="11" r="3" />
        <circle cx="7.6" cy="14.6" r=".8" fill="#fff" />
        <circle cx="16.8" cy="16" r=".7" fill="#fff" />
        <circle cx="8.6" cy="8" r=".6" fill="#fff" />
      </g>
    ),
  },
  {
    id: "e-molecule", label: "Molécula", from: "#f59e0b", to: "#b45309",
    icon: (
      <g {...S}>
        <circle cx="12" cy="12" r="2.6" />
        <circle cx="5.5" cy="6.5" r="2" />
        <circle cx="18.5" cy="6.5" r="2" />
        <circle cx="12" cy="20" r="2" />
        <path d="M7 7.8l3 2.4M17 7.8l-3 2.4M12 14.6V18" />
      </g>
    ),
  },
  {
    id: "e-yeast", label: "Levadura", from: "#a855f7", to: "#7e22ce",
    icon: (
      <g {...S}>
        <ellipse cx="10" cy="13" rx="5.5" ry="4.6" />
        <ellipse cx="16.6" cy="8" rx="3" ry="2.6" />
        <circle cx="9" cy="12.5" r="1.4" />
      </g>
    ),
  },
  {
    id: "e-leaf", label: "Bioproceso", from: "#84cc16", to: "#4d7c0f",
    icon: (
      <g {...S}>
        <path d="M5 19c0-8.5 6-14.5 15-14.5 0 9-6 15-15 14.5z" />
        <path d="M5 19l8-8" />
      </g>
    ),
  },
  {
    id: "e-gear", label: "Ingeniería", from: "#64748b", to: "#334155",
    icon: (
      <g {...S}>
        <circle cx="12" cy="12" r="3.2" />
        <path d="M12 3.5v2.3M12 18.2v2.3M3.5 12h2.3M18.2 12h2.3M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6" />
        <circle cx="12" cy="12" r="6.2" />
      </g>
    ),
  },
  {
    id: "e-pi", label: "Buckingham Π", from: "#06b6d4", to: "#0e7490",
    icon: (
      <text x="12" y="17" textAnchor="middle" fontSize="15" fontFamily="Cambria Math, Georgia, serif" fill="#fff">
        Π
      </text>
    ),
  },
  {
    id: "e-drop", label: "Gota", from: "#3b82f6", to: "#1d4ed8",
    icon: (
      <g {...S}>
        <path d="M12 3.5c4 4.8 6 8 6 10.7a6 6 0 0 1-12 0c0-2.7 2-5.9 6-10.7z" />
        <path d="M9.2 14.5a2.8 2.8 0 0 0 2.8 2.8" />
      </g>
    ),
  },
  {
    id: "e-thermo", label: "Temperatura", from: "#f43f5e", to: "#be123c",
    icon: (
      <g {...S}>
        <path d="M10 14.2V5.5a2 2 0 0 1 4 0v8.7a4 4 0 1 1-4 0z" />
        <path d="M12 9v8" />
      </g>
    ),
  },
  {
    id: "e-chart", label: "Datos", from: "#10b981", to: "#047857",
    icon: (
      <g {...S}>
        <path d="M4.5 4.5v15h15" />
        <path d="M7.5 15.5l3.5-4 3 2.5 5-6" />
        <circle cx="19" cy="8" r=".8" fill="#fff" />
      </g>
    ),
  },
  {
    id: "e-bubbles", label: "Aireación", from: "#38bdf8", to: "#0284c7",
    icon: (
      <g {...S}>
        <circle cx="9" cy="15" r="3.5" />
        <circle cx="15.5" cy="9" r="2.6" />
        <circle cx="16" cy="17" r="1.6" />
        <circle cx="9" cy="6.5" r="1.3" />
      </g>
    ),
  },
];

export const INITIALS: InitialsDef[] = [
  { id: "ini-teal", label: "Turquesa", from: "#2dd4bf", to: "#0f766e" },
  { id: "ini-violet", label: "Violeta", from: "#a78bfa", to: "#6d28d9" },
  { id: "ini-rose", label: "Rosa", from: "#fb7185", to: "#be123c" },
  { id: "ini-amber", label: "Ámbar", from: "#fbbf24", to: "#b45309" },
  { id: "ini-sky", label: "Cielo", from: "#38bdf8", to: "#1d4ed8" },
  { id: "ini-slate", label: "Grafito", from: "#94a3b8", to: "#334155" },
  { id: "ini-maroon", label: "Guinda ITD", from: "#be185d", to: "#7f1d1d" },
];

export const DEFAULT_AVATAR = "m1";

/** Convierte valores antiguos (1, 2, 3) y desconocidos en un id válido. */
export function normalizeAvatar(v: unknown): string {
  if (v === 1 || v === "1") return "m1";
  if (v === 2 || v === "2") return "m2";
  if (v === 3 || v === "3") return "m3";
  if (typeof v === "string" && (MASCOTS.some((m) => m.id === v) || EMBLEMS.some((e) => e.id === v) || INITIALS.some((i) => i.id === v))) return v;
  return DEFAULT_AVATAR;
}

export function avatarGroup(id: string): AvatarGroup {
  if (id.startsWith("e-")) return "ciencia";
  if (id.startsWith("ini-")) return "iniciales";
  return "personaje";
}

export function avatarLabel(id: string): string {
  return (
    MASCOTS.find((m) => m.id === id)?.label ??
    EMBLEMS.find((e) => e.id === id)?.label ??
    (INITIALS.find((i) => i.id === id) ? "Tus iniciales" : "Avatar")
  );
}

export function initialsOf(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w && !/^(de|del|la|las|los|y)$/i.test(w) && !/^[A-Z]{1,3}$/.test(w)); // ignora «IQ», «Ing»…
  if (!words.length) return "?";
  const first = words[0][0];
  const second = words.length > 1 ? words[1][0] : "";
  return (first + second).toUpperCase();
}

/** Dibuja cualquier avatar del catálogo. */
export function Avatar({ id, name = "", size = 40, title }: { id: string; name?: string; size?: number; title?: string }) {
  const aid = normalizeAvatar(id);
  const label = title ?? avatarLabel(aid);
  const mascot = MASCOTS.find((m) => m.id === aid);
  if (mascot) {
    return <img src={mascot.src} alt={label} title={label} width={size} height={size} className="avatar-img" />;
  }
  const emblem = EMBLEMS.find((e) => e.id === aid);
  const ini = INITIALS.find((i) => i.id === aid);
  const grad = emblem ?? ini!;
  const gid = `ag-${aid}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={label} className="avatar-svg">
      <title>{label}</title>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={grad.from} />
          <stop offset="1" stopColor={grad.to} />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="12" fill={`url(#${gid})`} />
      {emblem ? (
        <g transform="translate(2.4 2.4) scale(0.8)">{emblem.icon}</g>
      ) : (
        <text x="12" y="16.2" textAnchor="middle" fontSize="10.5" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#fff">
          {initialsOf(name)}
        </text>
      )}
    </svg>
  );
}
