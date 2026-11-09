/**
 * Contrato del almacenamiento en la nube. La app sólo depende de esta
 * interfaz; la implementación real usa Firebase (Auth + Firestore).
 */

/** Id del avatar (ver src/ui/avatars.tsx), p. ej. "m1", "e-dna", "ini-teal". */
export type AvatarId = string;

export interface CloudUser {
  uid: string;
  email: string;
  name: string;
  avatar: AvatarId;
}

export type DocKind = "analisis" | "simulacion";

export interface CloudDoc {
  id: string;
  owner: string;
  ownerName?: string;
  title: string;
  kind: DocKind;
  /** Contenido serializado (JSON). */
  payload: string;
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SaveInput {
  id?: string;
  title: string;
  kind: DocKind;
  payload: string;
}

export interface CloudBackend {
  readonly name: string;
  onAuth(cb: (u: CloudUser | null) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, name: string, avatar: AvatarId): Promise<void>;
  resetPassword(email: string): Promise<void>;
  signOut(): Promise<void>;
  updateProfile(name: string, avatar: AvatarId): Promise<void>;
  list(): Promise<CloudDoc[]>;
  get(id: string): Promise<CloudDoc | null>;
  save(input: SaveInput): Promise<CloudDoc>;
  remove(id: string): Promise<void>;
  setPublic(id: string, isPublic: boolean): Promise<void>;
}

export class CloudError extends Error {}
