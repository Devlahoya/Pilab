import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import type { FirebaseConfig } from "./firebaseBackend";
import { CloudBackend, CloudUser } from "./types";

/** Configuración de Firebase desde variables de entorno (ver .env.example). */
export function firebaseConfigFromEnv(): FirebaseConfig | null {
  const env = import.meta.env;
  const cfg = {
    apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: env.VITE_FIREBASE_APP_ID as string | undefined,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  };
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId || !cfg.appId) return null;
  return cfg as FirebaseConfig;
}

export function isDemoCloud(): boolean {
  try {
    return import.meta.env.DEV && new URLSearchParams(window.location.search).get("nube") === "demo";
  } catch {
    return false;
  }
}

/** Carga el backend sólo si está configurado (Firebase se descarga bajo demanda). */
async function loadBackend(): Promise<CloudBackend | null> {
  if (isDemoCloud()) {
    const { MockBackend } = await import("./mockBackend");
    return new MockBackend();
  }
  const cfg = firebaseConfigFromEnv();
  if (!cfg) return null;
  const { FirebaseBackend } = await import("./firebaseBackend");
  return new FirebaseBackend(cfg);
}

interface CloudState {
  /** null = la nube no está configurada. */
  backend: CloudBackend | null;
  user: CloudUser | null;
  /** Ya se sabe si hay sesión (o si no hay nube). */
  ready: boolean;
}

const Ctx = createContext<CloudState>({ backend: null, user: null, ready: false });

export function CloudProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CloudState>({ backend: null, user: null, ready: false });

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let alive = true;
    loadBackend()
      .then((backend) => {
        if (!alive) return;
        if (!backend) {
          setState({ backend: null, user: null, ready: true });
          return;
        }
        setState({ backend, user: null, ready: false });
        unsub = backend.onAuth((user) => setState({ backend, user, ready: true }));
      })
      .catch(() => alive && setState({ backend: null, user: null, ready: true }));
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useCloud = () => useContext(Ctx);
