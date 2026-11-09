import { useEffect, useMemo, useRef, useState } from "react";
import {
  KIND_BY_ID,
  QUANTITY_CATEGORIES,
  QuantityKind,
  dimEquals,
  formatDim,
  searchKinds,
  tryParseUnit,
} from "../core";
import { VariableRow } from "../processes/project";
import { Sym } from "./Math";

interface Props {
  rows: VariableRow[];
  dependentId?: string;
  isolatedIds: string[];
  onChange: (id: string, patch: Partial<VariableRow>) => void;
  onRemove: (id: string) => void;
  onAddKind: (kindId: string) => void;
  onAddCustom: () => void;
  onDependent: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

export function VariableTable(p: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="vars">
      {p.rows.length === 0 && (
        <div className="empty">
          <p>
            Agrega las variables de las que crees que depende el fenómeno: geometría, velocidades, propiedades del
            fluido y la variable que quieres predecir.
          </p>
        </div>
      )}

      {p.rows.length > 0 && (
        <div className="var-head" aria-hidden>
          <span title="Variable de interés (la que quieres predecir)">Interés</span>
          <span>Símbolo</span>
          <span>Variable</span>
          <span>Unidades</span>
          <span>Valor</span>
          <span />
        </div>
      )}

      <ul className="var-list">
        {p.rows.map((r, idx) => (
          <VariableRowView
            key={r.id}
            row={r}
            first={idx === 0}
            last={idx === p.rows.length - 1}
            isDependent={p.dependentId === r.id}
            isolated={p.isolatedIds.includes(r.id)}
            {...p}
          />
        ))}
      </ul>

      <div className="var-actions">
        <button className="btn btn-primary" onClick={() => setPickerOpen(true)}>
          ＋ Agregar variable
        </button>
        <button className="btn" onClick={p.onAddCustom}>
          ＋ Variable personalizada
        </button>
      </div>

      {pickerOpen && (
        <KindPicker
          onClose={() => setPickerOpen(false)}
          onPick={(k) => {
            p.onAddKind(k.id);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}

function VariableRowView({
  row,
  first,
  last,
  isDependent,
  isolated,
  onChange,
  onRemove,
  onDependent,
  onMove,
}: Props & { row: VariableRow; first: boolean; last: boolean; isDependent: boolean; isolated: boolean }) {
  const parsed = tryParseUnit(row.unit);
  const kind = row.kindId ? KIND_BY_ID[row.kindId] : undefined;
  const kindMismatch = kind && parsed && !dimEquals(kind.dims, parsed.dims);

  return (
    <li className={`var-row ${isDependent ? "is-dep" : ""} ${isolated ? "is-isolated" : ""}`}>
      <label className="cell cell-dep" title="Marcar como variable de interés">
        <input type="radio" name="dependent" checked={isDependent} onChange={() => onDependent(row.id)} />
        <span className="sr-only">Variable de interés</span>
      </label>

      <div className="cell cell-symbol">
        <input
          className="input input-symbol"
          value={row.symbol}
          aria-label="Símbolo"
          onChange={(e) => onChange(row.id, { symbol: e.target.value })}
        />
        <span className="symbol-preview" aria-hidden>
          <Sym s={row.symbol || "?"} />
        </span>
      </div>

      <div className="cell cell-name">
        <input
          className="input"
          value={row.name}
          title={row.name}
          aria-label="Nombre de la variable"
          onChange={(e) => onChange(row.id, { name: e.target.value })}
        />
        <span className="hint">
          {isDependent && <span className="tag tag-dep">la que quieres predecir</span>}
          {isolated && <span className="tag tag-warn">no entra en ningún grupo</span>}
          {kindMismatch && (
            <span className="tag tag-warn" title={`Las unidades no corresponden a «${kind!.name}»; no se usará para reconocer números con nombre.`}>
              unidades distintas al tipo
            </span>
          )}
          {!kind && <span className="tag">personalizada</span>}
        </span>
      </div>

      <div className="cell cell-unit">
        <input
          className={`input ${parsed ? "" : "input-error"}`}
          value={row.unit}
          aria-label="Unidades"
          placeholder="p. ej. kg/m3"
          onChange={(e) => onChange(row.id, { unit: e.target.value })}
        />
        <span className={`hint ${parsed ? "dims" : "error"}`}>
          {parsed ? formatDim(parsed.dims) : "Unidad no reconocida"}
        </span>
      </div>

      <div className="cell cell-value">
        <input
          className="input"
          value={row.value}
          inputMode="decimal"
          aria-label="Valor (opcional)"
          placeholder="opcional"
          onChange={(e) => onChange(row.id, { value: e.target.value })}
        />
      </div>

      <div className="cell cell-tools">
        <button className="icon-btn" title="Subir" disabled={first} onClick={() => onMove(row.id, -1)}>
          ↑
        </button>
        <button className="icon-btn" title="Bajar" disabled={last} onClick={() => onMove(row.id, 1)}>
          ↓
        </button>
        <button className="icon-btn danger" title="Quitar variable" onClick={() => onRemove(row.id)}>
          ✕
        </button>
      </div>
    </li>
  );
}

function KindPicker({ onPick, onClose }: { onPick: (k: QuantityKind) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const results = useMemo(() => searchKinds(q), [q]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Agregar variable" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Agregar variable</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>
        <input
          ref={inputRef}
          className="input input-search"
          placeholder="Buscar: viscosidad, diámetro, kLa, rpm…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) onPick(results[0]);
          }}
        />
        <div className="modal-body">
          {QUANTITY_CATEGORIES.map((cat) => {
            const items = results.filter((k) => k.category === cat);
            if (!items.length) return null;
            return (
              <div key={cat} className="kind-group">
                <h4>{cat}</h4>
                <div className="kind-list">
                  {items.map((k) => (
                    <button key={k.id} className="kind-item" onClick={() => onPick(k)}>
                      <span className="kind-symbol">
                        <Sym s={k.symbol} />
                      </span>
                      <span className="kind-name">{k.name}</span>
                      <span className="kind-unit">{k.unit}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {results.length === 0 && <p className="muted">Nada coincide. Usa «Variable personalizada» y escribe sus unidades.</p>}
        </div>
      </div>
    </div>
  );
}
