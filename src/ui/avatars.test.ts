import { describe, expect, it } from "vitest";
import { EMBLEMS, INITIALS, MASCOTS, avatarGroup, initialsOf, normalizeAvatar } from "./avatars";

describe("Avatares", () => {
  it("convierte los perfiles antiguos (1, 2, 3) y valores desconocidos", () => {
    expect(normalizeAvatar(1)).toBe("m1");
    expect(normalizeAvatar(3)).toBe("m3");
    expect(normalizeAvatar("e-dna")).toBe("e-dna");
    expect(normalizeAvatar("no-existe")).toBe("m1");
    expect(normalizeAvatar(undefined)).toBe("m1");
  });

  it("ids únicos y de máximo 32 caracteres (lo exigen las reglas de Firestore)", () => {
    const ids = [...MASCOTS, ...EMBLEMS, ...INITIALS].map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeLessThanOrEqual(32);
    expect(EMBLEMS.length).toBeGreaterThanOrEqual(12);
  });

  it("agrupa por tipo", () => {
    expect(avatarGroup("m2")).toBe("personaje");
    expect(avatarGroup("e-cell")).toBe("ciencia");
    expect(avatarGroup("ini-rose")).toBe("iniciales");
  });

  it("iniciales: ignora títulos como «IQ» y partículas", () => {
    expect(initialsOf("IQ Esmeralda Hernández Alvarado")).toBe("EH");
    expect(initialsOf("María de la Luz")).toBe("ML");
    expect(initialsOf("ana")).toBe("A");
    expect(initialsOf("   ")).toBe("?");
  });
});
