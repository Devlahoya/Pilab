import { useMemo, useState } from "react";
import { NUMBERS, NUMBER_AREAS } from "../core";
import { Sym } from "./Math";

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function Library() {
  const [q, setQ] = useState("");
  const items = useMemo(() => {
    const t = norm(q.trim());
    return t ? NUMBERS.filter((n) => norm(`${n.symbol} ${n.name} ${n.meaning} ${n.area}`).includes(t)) : NUMBERS;
  }, [q]);

  return (
    <div className="library">
      <header className="library-head">
        <div>
          <h1>Biblioteca de números adimensionales</h1>
          <p className="muted">
            La app reconoce automáticamente estos números cuando tus variables permiten formarlos.
          </p>
        </div>
        <input
          className="input input-search"
          placeholder="Buscar: Reynolds, calor, burbujas…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </header>
      {NUMBER_AREAS.map((area) => {
        const list = items.filter((n) => n.area === area);
        if (!list.length) return null;
        return (
          <section key={area} className="library-section">
            <h2>{area}</h2>
            <div className="library-grid">
              {list.map((n) => (
                <article key={n.id} className="lib-card">
                  <header>
                    <span className="lib-symbol">
                      <Sym s={n.symbol} />
                    </span>
                    <span className="lib-name">{n.name}</span>
                  </header>
                  <p className="lib-formula">{n.formula}</p>
                  <p className="lib-meaning">{n.meaning}</p>
                  {n.notes && <p className="lib-notes">{n.notes}</p>}
                </article>
              ))}
            </div>
          </section>
        );
      })}
      {items.length === 0 && <p className="muted">No hay coincidencias.</p>}
    </div>
  );
}
