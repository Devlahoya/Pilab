/**
 * Implementación con Firebase: Authentication (correo y contraseña) y
 * Cloud Firestore.
 *
 * Colecciones:
 *   users/{uid}      { name, avatar }
 *   projects/{id}    { owner, ownerName, title, kind, payload, isPublic, createdAt, updatedAt }
 *
 * Las reglas de seguridad están en firestore.rules (raíz del proyecto).
 */
import { FirebaseApp, initializeApp } from "firebase/app";
import {
  Auth,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  Firestore,
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore/lite"; // versión ligera: sin tiempo real, mucho menor
import { AvatarId, CloudBackend, CloudDoc, CloudError, CloudUser, SaveInput } from "./types";
import { normalizeAvatar } from "../ui/avatars";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-email": "El correo no es válido.",
  "auth/missing-password": "Escribe tu contraseña.",
  "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
  "auth/email-already-in-use": "Ya existe una cuenta con ese correo. Inicia sesión.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/wrong-password": "Correo o contraseña incorrectos.",
  "auth/user-not-found": "No hay una cuenta con ese correo.",
  "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
  "auth/network-request-failed": "Sin conexión a internet.",
  "auth/operation-not-allowed": "El acceso con correo no está habilitado en Firebase (ver docs/FIREBASE.md).",
  "permission-denied": "No tienes permiso para ver o cambiar este proyecto.",
  "unavailable": "El servicio no está disponible. Revisa tu conexión.",
};

function translate(e: unknown): CloudError {
  const code = (e as { code?: string })?.code ?? "";
  return new CloudError(AUTH_ERRORS[code] ?? `Error de la nube${code ? ` (${code})` : ""}.`);
}

const toMillis = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : Date.now());

export class FirebaseBackend implements CloudBackend {
  readonly name = "Firebase";
  private app: FirebaseApp;
  private auth: Auth;
  private db: Firestore;
  private profile: { name: string; avatar: AvatarId } | null = null;

  constructor(cfg: FirebaseConfig) {
    this.app = initializeApp(cfg);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
  }

  onAuth(cb: (u: CloudUser | null) => void): () => void {
    return onAuthStateChanged(this.auth, async (fu) => {
      if (!fu) {
        this.profile = null;
        cb(null);
        return;
      }
      try {
        const snap = await getDoc(doc(this.db, "users", fu.uid));
        const d = snap.data() as { name?: string; avatar?: unknown } | undefined;
        this.profile = { name: d?.name ?? fu.displayName ?? fu.email?.split("@")[0] ?? "Usuario", avatar: normalizeAvatar(d?.avatar) };
      } catch {
        this.profile = { name: fu.displayName ?? "Usuario", avatar: normalizeAvatar(undefined) };
      }
      cb({ uid: fu.uid, email: fu.email ?? "", ...this.profile });
    });
  }

  async signIn(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(this.auth, email.trim(), password);
    } catch (e) {
      throw translate(e);
    }
  }

  async signUp(email: string, password: string, name: string, avatar: AvatarId) {
    try {
      const cred = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(this.db, "users", cred.user.uid), { name, avatar });
      this.profile = { name, avatar };
    } catch (e) {
      throw translate(e);
    }
  }

  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(this.auth, email.trim());
    } catch (e) {
      throw translate(e);
    }
  }

  async signOut() {
    await signOut(this.auth);
  }

  async updateProfile(name: string, avatar: AvatarId) {
    const u = this.auth.currentUser;
    if (!u) throw new CloudError("Inicia sesión primero.");
    try {
      await setDoc(doc(this.db, "users", u.uid), { name, avatar });
      await updateProfile(u, { displayName: name });
      this.profile = { name, avatar };
    } catch (e) {
      throw translate(e);
    }
  }

  private fromSnap(id: string, d: Record<string, unknown>): CloudDoc {
    return {
      id,
      owner: String(d.owner),
      ownerName: d.ownerName as string | undefined,
      title: String(d.title ?? "Sin título"),
      kind: (d.kind as CloudDoc["kind"]) ?? "analisis",
      payload: String(d.payload ?? "{}"),
      isPublic: !!d.isPublic,
      createdAt: toMillis(d.createdAt),
      updatedAt: toMillis(d.updatedAt),
    };
  }

  async list(): Promise<CloudDoc[]> {
    const u = this.auth.currentUser;
    if (!u) return [];
    try {
      // Sin orderBy para no requerir un índice compuesto: se ordena aquí.
      const snap = await getDocs(query(collection(this.db, "projects"), where("owner", "==", u.uid)));
      return snap.docs.map((s) => this.fromSnap(s.id, s.data())).sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      throw translate(e);
    }
  }

  async get(id: string): Promise<CloudDoc | null> {
    try {
      const s = await getDoc(doc(this.db, "projects", id));
      return s.exists() ? this.fromSnap(s.id, s.data()) : null;
    } catch (e) {
      throw translate(e);
    }
  }

  async save(input: SaveInput): Promise<CloudDoc> {
    const u = this.auth.currentUser;
    if (!u) throw new CloudError("Inicia sesión para guardar en la nube.");
    try {
      if (input.id) {
        await updateDoc(doc(this.db, "projects", input.id), {
          title: input.title,
          kind: input.kind,
          payload: input.payload,
          updatedAt: serverTimestamp(),
        });
        return (await this.get(input.id))!;
      }
      const ref = await addDoc(collection(this.db, "projects"), {
        owner: u.uid,
        ownerName: this.profile?.name ?? "",
        title: input.title,
        kind: input.kind,
        payload: input.payload,
        isPublic: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return (await this.get(ref.id))!;
    } catch (e) {
      throw translate(e);
    }
  }

  async remove(id: string) {
    try {
      await deleteDoc(doc(this.db, "projects", id));
    } catch (e) {
      throw translate(e);
    }
  }

  async setPublic(id: string, isPublic: boolean) {
    try {
      await updateDoc(doc(this.db, "projects", id), { isPublic, updatedAt: serverTimestamp() });
    } catch (e) {
      throw translate(e);
    }
  }
}
