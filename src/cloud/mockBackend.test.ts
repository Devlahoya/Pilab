import { beforeEach, describe, expect, it } from "vitest";
import { MockBackend } from "./mockBackend";

// localStorage mínimo para el entorno de pruebas
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
};

describe("Backend de demostración (mismo contrato que Firebase)", () => {
  beforeEach(() => mem.clear());

  it("crear, actualizar (sin duplicar), listar y borrar", async () => {
    const b = new MockBackend();
    await b.signUp("a@b.mx", "secreto1", "Ana", 2);
    const d1 = await b.save({ id: undefined, title: "Uno", kind: "analisis", payload: "{}" });
    expect(d1.id).toBeTruthy();
    const d2 = await b.save({ id: d1.id, title: "Uno (v2)", kind: "analisis", payload: '{"x":1}' });
    expect(d2.id).toBe(d1.id);
    const list = await b.list();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Uno (v2)");
    await b.remove(d1.id);
    expect(await b.list()).toHaveLength(0);
  });

  it("los proyectos privados no los ve otra cuenta; los compartidos sí", async () => {
    const b = new MockBackend();
    await b.signUp("a@b.mx", "secreto1", "Ana", 1);
    const d = await b.save({ title: "Privado", kind: "simulacion", payload: "{}" });
    await b.signOut();
    await b.signUp("c@d.mx", "secreto2", "Beto", 3);
    await expect(b.get(d.id)).rejects.toThrow();
    await b.signOut();
    await b.signIn("a@b.mx", "secreto1");
    await b.setPublic(d.id, true);
    await b.signOut();
    expect((await b.get(d.id))?.title).toBe("Privado");
  });

  it("valida contraseña y correo duplicado", async () => {
    const b = new MockBackend();
    await expect(b.signUp("a@b.mx", "123", "Ana", 1)).rejects.toThrow(/6 caracteres/);
    await b.signUp("a@b.mx", "secreto1", "Ana", 1);
    await expect(b.signUp("a@b.mx", "secreto1", "Ana", 1)).rejects.toThrow(/Ya existe/);
  });
});
