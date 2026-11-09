/**
 * Backend de demostración (sólo en desarrollo, con ?nube=demo en la URL).
 * Imita a Firebase guardando todo en el almacenamiento del navegador para
 * poder probar las pantallas de cuentas y proyectos sin configurar nada.
 * No guarda contraseñas: cualquier contraseña de 6+ caracteres es válida.
 */
import { AvatarId, CloudBackend, CloudDoc, CloudError, CloudUser, SaveInput } from "./types";
import { normalizeAvatar } from "../ui/avatars";

const KEY = "pilab.mockcloud.v1";

interface Store {
  users: Record<string, { uid: string; email: string; name: string; avatar: AvatarId }>;
  docs: Record<string, CloudDoc>;
  session: string | null;
}

function load(): Store {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "");
    if (s && s.users && s.docs) return s;
  } catch {
    /* vacío */
  }
  return { users: {}, docs: {}, session: null };
}

export class MockBackend implements CloudBackend {
  readonly name = "Demostración local";
  private s = load();
  private listeners = new Set<(u: CloudUser | null) => void>();

  private persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.s));
    } catch {
      /* sin almacenamiento */
    }
  }
  private current(): CloudUser | null {
    const u = this.s.session ? Object.values(this.s.users).find((x) => x.uid === this.s.session) : undefined;
    return u ? { ...u, avatar: normalizeAvatar(u.avatar) } : null;
  }
  private emit() {
    const u = this.current();
    this.listeners.forEach((l) => l(u));
  }
  private delay() {
    return new Promise((r) => setTimeout(r, 250));
  }

  onAuth(cb: (u: CloudUser | null) => void) {
    this.listeners.add(cb);
    setTimeout(() => cb(this.current()), 0);
    return () => this.listeners.delete(cb);
  }
  async signIn(email: string, password: string) {
    await this.delay();
    const u = this.s.users[email.trim().toLowerCase()];
    if (!u || password.length < 6) throw new CloudError("Correo o contraseña incorrectos.");
    this.s.session = u.uid;
    this.persist();
    this.emit();
  }
  async signUp(email: string, password: string, name: string, avatar: AvatarId) {
    await this.delay();
    const e = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(e)) throw new CloudError("El correo no es válido.");
    if (password.length < 6) throw new CloudError("La contraseña debe tener al menos 6 caracteres.");
    if (this.s.users[e]) throw new CloudError("Ya existe una cuenta con ese correo. Inicia sesión.");
    const uid = `u${Date.now().toString(36)}`;
    this.s.users[e] = { uid, email: e, name, avatar };
    this.s.session = uid;
    this.persist();
    this.emit();
  }
  async resetPassword(email: string) {
    await this.delay();
    if (!this.s.users[email.trim().toLowerCase()]) throw new CloudError("No hay una cuenta con ese correo.");
  }
  async signOut() {
    this.s.session = null;
    this.persist();
    this.emit();
  }
  async updateProfile(name: string, avatar: AvatarId) {
    const u = this.current();
    if (!u) throw new CloudError("Inicia sesión primero.");
    this.s.users[u.email] = { ...this.s.users[u.email], name, avatar };
    this.persist();
    this.emit();
  }
  async list() {
    await this.delay();
    const u = this.current();
    return Object.values(this.s.docs).filter((d) => d.owner === u?.uid).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async get(id: string) {
    await this.delay();
    const d = this.s.docs[id];
    if (!d) return null;
    if (!d.isPublic && d.owner !== this.current()?.uid) throw new CloudError("No tienes permiso para ver o cambiar este proyecto.");
    return d;
  }
  async save(input: SaveInput) {
    await this.delay();
    const u = this.current();
    if (!u) throw new CloudError("Inicia sesión para guardar en la nube.");
    const now = Date.now();
    if (input.id && this.s.docs[input.id]) {
      const d = this.s.docs[input.id];
      if (d.owner !== u.uid) throw new CloudError("No tienes permiso para ver o cambiar este proyecto.");
      this.s.docs[input.id] = { ...d, ...input, id: input.id, updatedAt: now };
    } else {
      const id = `d${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      this.s.docs[id] = {
        title: input.title, kind: input.kind, payload: input.payload,
        id, owner: u.uid, ownerName: u.name, isPublic: false, createdAt: now, updatedAt: now,
      };
      input = { ...input, id };
    }
    this.persist();
    return this.s.docs[input.id!];
  }
  async remove(id: string) {
    await this.delay();
    delete this.s.docs[id];
    this.persist();
  }
  async setPublic(id: string, isPublic: boolean) {
    await this.delay();
    const d = this.s.docs[id];
    if (d) this.s.docs[id] = { ...d, isPublic, updatedAt: Date.now() };
    this.persist();
  }
}
