import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyze, buildRelation, evaluateGroup, groupToText } from "./core";
import {
  Project,
  VariableRow,
  buildVariables,
  emptyProject,
  newId,
  projectFromTemplate,
  rowFromKind,
} from "./processes/project";
import { TEMPLATE_BY_ID } from "./processes/templates";
import { computeCorrelation } from "./processes/correlation";
import { DataPanel } from "./ui/DataPanel";
import { Guide } from "./ui/Guide";
import { SimIncoming, SimulatorView } from "./ui/sim/SimulatorView";
import { useCloud } from "./cloud/CloudContext";
import { CloudDoc } from "./cloud/types";
import { AccountButton } from "./ui/cloud/AccountButton";
import { AuthDialog } from "./ui/cloud/AuthDialog";
import { CloudSaveButton } from "./ui/cloud/CloudSaveButton";
import { ProjectsView } from "./ui/cloud/ProjectsView";
import { NavIcon } from "./ui/NavIcon";
import { AUTHOR, INSTITUTION, PROGRAM } from "./brand";
import { WelcomeBanner, WhatIfBox } from "./ui/HelpBox";
import { Library } from "./ui/Library";
import { ProcedurePanel } from "./ui/ProcedurePanel";
import { ResultsPanel } from "./ui/ResultsPanel";
import { ScalePanel } from "./ui/ScalePanel";
import { TemplateGallery } from "./ui/TemplateGallery";
import { VariableTable } from "./ui/VariableTable";
import { ProcessDiagram, labelsFrom } from "./ui/diagrams";
import { MathText } from "./ui/Math";
import { formatValue } from "./ui/format";

type View = "plantillas" | "analisis" | "simulador" | "proyectos" | "biblioteca" | "guia";

const NAV: { view: View; label: string; short: string; mobile: boolean }[] = [
  { view: "plantillas", label: "Plantillas", short: "Inicio", mobile: true },
  { view: "analisis", label: "Análisis", short: "Análisis", mobile: true },
  { view: "simulador", label: "Simulador", short: "Simulador", mobile: true },
  { view: "proyectos", label: "Mis proyectos", short: "Proyectos", mobile: true },
  { view: "biblioteca", label: "Biblioteca", short: "Biblioteca", mobile: false },
  { view: "guia", label: "¿Cómo funciona?", short: "Guía", mobile: true },
];
const STORAGE_KEY = "pilab.project.v1";

function normalizeProject(data: unknown): Project | null {
  const p = data as Partial<Project> | null;
  if (!p || !Array.isArray(p.rows)) return null;
  return {
    ...p,
    title: p.title ?? "Análisis",
    rows: p.rows,
    repeatingIds: p.repeatingIds ?? [],
    pinned: p.pinned ?? [],
  };
}

function loadProject(): Project | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

function uniqueSymbol(rows: VariableRow[], symbol: string): string {
  const used = new Set(rows.map((r) => r.symbol));
  if (!used.has(symbol)) return symbol;
  const base = symbol.includes("_") ? symbol : `${symbol}_`;
  for (let i = 2; ; i++) {
    if (!used.has(`${base}${i}`)) return `${base}${i}`;
  }
}

export default function App() {
  const [project, setProject] = useState<Project | null>(loadProject);
  const [view, setView] = useState<View>(() => (project ? "analisis" : "plantillas"));
  const [tab, setTab] = useState<"resultado" | "procedimiento">("resultado");
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      if (project) localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
    } catch {
      /* almacenamiento no disponible */
    }
  }, [project]);

  const toastTimer = useRef<number | undefined>(undefined);
  const notify = useCallback((msg: string, ms = 2800) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  /* ─── nube */
  const { backend, user, ready: cloudReady } = useCloud();
  const [authMode, setAuthMode] = useState<null | "entrar" | "perfil">(null);
  const [savedPayloads, setSavedPayloads] = useState<Record<string, string>>({});
  const [projectsKey, setProjectsKey] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [simIncoming, setSimIncoming] = useState<SimIncoming | null>(null);

  const go = useCallback((v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const openDoc = useCallback(
    (d: CloudDoc, own: boolean) => {
      try {
        const data = JSON.parse(d.payload);
        if (d.kind === "analisis") {
          const np = normalizeProject(data);
          if (!np) throw new Error();
          const clean = { ...np, cloudId: undefined };
          setProject({ ...np, cloudId: own ? d.id : undefined });
          if (own) setSavedPayloads((s) => ({ ...s, [d.id]: JSON.stringify(clean) }));
          setTab("resultado");
          go("analisis");
        } else {
          setSimIncoming({ ...data, title: d.title, cloudId: own ? d.id : undefined, savedPayload: own ? d.payload : undefined, nonce: Date.now() });
          go("simulador");
        }
      } catch {
        notify("El proyecto está dañado o tiene un formato desconocido.");
      }
    },
    [go, notify],
  );

  // Enlaces compartidos: ?ver=<id>
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (sharedHandled.current || !cloudReady) return;
    const id = new URLSearchParams(window.location.search).get("ver");
    if (!id) return;
    sharedHandled.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("ver");
    window.history.replaceState(null, "", url.toString());
    if (!backend) {
      setBanner("Este enlace es de un proyecto guardado en la nube, pero esta copia de la app no tiene la nube configurada.");
      return;
    }
    backend
      .get(id)
      .then((d) => {
        if (!d) {
          setBanner("El proyecto compartido ya no existe o dejó de ser público.");
          return;
        }
        const own = !!user && d.owner === user.uid;
        openDoc(d, own);
        if (!own) setBanner(`Estás viendo una copia de «${d.title}»${d.ownerName ? `, compartido por ${d.ownerName}` : ""}. Tus cambios no modifican el original.`);
      })
      .catch((e) => setBanner(e instanceof Error ? e.message : "No se pudo abrir el enlace."));
  }, [cloudReady, backend, user, openDoc]);

  const p = project ?? emptyProject();
  const built = useMemo(() => buildVariables(p.rows), [p.rows]);
  const repeating = useMemo(
    () => p.repeatingIds.filter((id) => built.vars.some((v) => v.id === id)),
    [p.repeatingIds, built.vars],
  );
  const dependentId = built.vars.some((v) => v.id === p.dependentId) ? p.dependentId : undefined;
  const analysis = useMemo(
    () => analyze({ variables: built.vars, dependentId, repeatingIds: repeating }),
    [built.vars, dependentId, repeating],
  );
  const relation = useMemo(
    () => buildRelation(built.vars, analysis, { dependentId, pinned: p.pinned, preferred: p.preferred }),
    [built.vars, analysis, dependentId, p.pinned, p.preferred],
  );

  // Avisa qué grupos aparecen o desaparecen al agregar/quitar variables
  const groupSymbols = [relation.dependent, ...relation.independents]
    .filter(Boolean)
    .map((g) => g!.symbol)
    .join("|");
  const prevGroups = useRef<{ n: number; syms: string; template?: string } | null>(null);
  useEffect(() => {
    const prev = prevGroups.current;
    const cur = { n: built.vars.length, syms: groupSymbols, template: p.templateId };
    prevGroups.current = cur;
    if (!prev || prev.template !== cur.template || prev.n === cur.n) return;
    const before = prev.syms ? prev.syms.split("|") : [];
    const after = cur.syms ? cur.syms.split("|") : [];
    const added = after.filter((s) => !before.includes(s) && !s.startsWith("Π"));
    const removed = before.filter((s) => !after.includes(s) && !s.startsWith("Π"));
    const parts = [];
    if (added.length) parts.push(`apareció ${added.join(", ")}`);
    if (removed.length) parts.push(`desapareció ${removed.join(", ")}`);
    const kText = `${analysis.k} grupo${analysis.k === 1 ? "" : "s"}`;
    notify(parts.length ? `Ahora hay ${kText}: ${parts.join("; ")}.` : `Ahora hay ${kText}.`, 3800);
  }, [built.vars.length, groupSymbols, p.templateId, analysis.k, notify]);

  const diagramLabels = useMemo(() => labelsFrom(p.rows), [p.rows]);
  /** Contenido del análisis para la nube (sin el id de la nube, para comparar cambios). */
  const analysisPayload = useMemo(() => JSON.stringify({ ...p, cloudId: undefined }), [p]);
  const correlation = useMemo(
    () => computeCorrelation(built.vars, p.rows, relation, p.data),
    [built.vars, p.rows, relation, p.data],
  );

  const update = (fn: (p: Project) => Project) => setProject((cur) => fn(cur ?? emptyProject()));
  const template = p.templateId ? TEMPLATE_BY_ID[p.templateId] : undefined;

  const updateRow = (id: string, patch: Partial<VariableRow>) =>
    update((cur) => ({ ...cur, rows: cur.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));

  const removeRow = (id: string) =>
    update((cur) => ({
      ...cur,
      rows: cur.rows.filter((r) => r.id !== id),
      dependentId: cur.dependentId === id ? undefined : cur.dependentId,
      repeatingIds: cur.repeatingIds.filter((x) => x !== id),
    }));

  const moveRow = (id: string, dir: -1 | 1) =>
    update((cur) => {
      const i = cur.rows.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.rows.length) return cur;
      const rows = cur.rows.slice();
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...cur, rows };
    });

  const addKind = (kindId: string) =>
    update((cur) => {
      const row = rowFromKind(kindId);
      row.symbol = uniqueSymbol(cur.rows, row.symbol);
      return { ...cur, rows: [...cur.rows, row], dependentId: cur.dependentId ?? (cur.rows.length === 0 ? row.id : undefined) };
    });

  const addCustom = () =>
    update((cur) => ({
      ...cur,
      rows: [...cur.rows, { id: newId(), symbol: uniqueSymbol(cur.rows, "x"), name: "Nueva variable", unit: "", value: "" }],
    }));

  const toggleRepeating = (id: string) =>
    update((cur) => {
      const base = repeating.length ? repeating : analysis.repeatingIds;
      const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
      return { ...cur, repeatingIds: next };
    });

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.title.replace(/[^\w\-áéíóúñ ]+/gi, "").trim() || "analisis"}.pilab.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    try {
      const data = normalizeProject(JSON.parse(await file.text()));
      if (!data) throw new Error();
      setProject(data);
      setView("analisis");
      notify("Análisis importado");
    } catch {
      notify("El archivo no es un análisis válido");
    }
  };

  const copySummary = async () => {
    const vars = built.vars;
    const all = [relation.dependent, ...relation.independents].filter(Boolean) as NonNullable<typeof relation.dependent>[];
    const lines = [
      `${p.title}`,
      ``,
      `Variables (n = ${analysis.n}):`,
      ...p.rows.map((r) => `  ${r.symbol} — ${r.name} [${r.unit || "1"}]${r.value ? ` = ${r.value}` : ""}`),
      ``,
      `Dimensiones independientes r = ${analysis.rank}  →  k = ${analysis.k} grupos adimensionales`,
      ``,
      relation.dependent
        ? `${relation.dependent.symbol} = f(${relation.independents.map((g) => g.symbol).join(", ")})`
        : `F(${relation.independents.map((g) => g.symbol).join(", ")}) = 0`,
      ``,
      ...all.map((g) => {
        const v = evaluateGroup(vars, g.exponents);
        return `  ${g.symbol} = ${groupToText(vars, g.exponents, g.termOrder)}${v !== null ? `  ≈ ${formatValue(v)}` : ""}`;
      }),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      notify("Resumen copiado al portapapeles");
    } catch {
      notify("No se pudo copiar");
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => go("plantillas")} aria-label="PiLab, ir al inicio" title="Ir al inicio">
          <span className="brand-logos">
            <img src="/img/itd.png" alt={INSTITUTION} />
            <img src="/img/mcibq.jpg" alt={PROGRAM} />
          </span>
          <span className="brand-mark" aria-hidden>
            Π
          </span>
          <span className="brand-text">
            <strong>PiLab</strong>
            <span className="brand-author">{AUTHOR}</span>
          </span>
        </button>
        <nav className="nav nav-top" aria-label="Secciones">
          {NAV.map((n) => (
            <button key={n.view} className={view === n.view ? "active" : ""} onClick={() => go(n.view)} aria-current={view === n.view ? "page" : undefined}>
              <span className="label-long">{n.label}</span>
              <span className="label-short">{n.short === "Inicio" ? "Plantillas" : n.short}</span>
            </button>
          ))}
        </nav>
        <AccountButton onLogin={() => setAuthMode("entrar")} onProfile={() => setAuthMode("perfil")} onProjects={() => go("proyectos")} />
      </header>

      {/* Barra inferior en celulares */}
      <nav className="nav-bottom" aria-label="Secciones">
        {NAV.filter((n) => n.mobile).map((n) => (
          <button key={n.view} className={view === n.view ? "active" : ""} onClick={() => go(n.view)} aria-current={view === n.view ? "page" : undefined}>
            <NavIcon view={n.view} />
            <span>{n.short}</span>
          </button>
        ))}
      </nav>

      <main className="main">
        {banner && (
          <div className="alert alert-info banner" role="status">
            <span>{banner}</span>
            <button className="icon-btn" onClick={() => setBanner(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        )}

        {view === "plantillas" && (
          <TemplateGallery
            onPick={(t) => {
              setProject(projectFromTemplate(t));
              setTab("resultado");
              go("analisis");
            }}
            onBlank={() => {
              setProject(emptyProject());
              setTab("resultado");
              go("analisis");
            }}
            onGuide={() => go("guia")}
          />
        )}

        {view === "biblioteca" && <Library />}

        {view === "guia" && <Guide onStart={() => go("plantillas")} onLibrary={() => go("biblioteca")} />}

        {view === "proyectos" && (
          <ProjectsView
            refreshKey={projectsKey}
            onOpen={(d) => openDoc(d, true)}
            onLogin={() => setAuthMode("entrar")}
            onGuide={() => go("guia")}
          />
        )}

        {/* Se mantiene montado para no perder la simulación al cambiar de sección */}
        <div hidden={view !== "simulador"}>
          <SimulatorView incoming={simIncoming} notify={notify} onNeedLogin={() => setAuthMode("entrar")} onSaved={() => setProjectsKey((k) => k + 1)} />
        </div>

        {view === "analisis" && (
          <div className="workspace">
            <div className="ws-head">
              <input
                className="title-input"
                value={p.title}
                aria-label="Nombre del análisis"
                onChange={(e) => update((cur) => ({ ...cur, title: e.target.value }))}
              />
              <div className="ws-tools">
                <CloudSaveButton
                  kind="analisis"
                  title={p.title}
                  payload={analysisPayload}
                  cloudId={p.cloudId}
                  savedPayload={p.cloudId ? savedPayloads[p.cloudId] : undefined}
                  onSaved={(doc, payload) => {
                    setSavedPayloads((s) => ({ ...s, [doc.id]: payload }));
                    update((cur) => ({ ...cur, cloudId: doc.id }));
                    setProjectsKey((k) => k + 1);
                  }}
                  onNeedLogin={() => setAuthMode("entrar")}
                  notify={notify}
                />
                <button className="btn btn-sm" onClick={copySummary} disabled={!analysis.n}>
                  Copiar resumen
                </button>
                <button className="btn btn-sm" onClick={exportJson}>
                  Guardar archivo
                </button>
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                  Abrir archivo
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importJson(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            <WelcomeBanner onGuide={() => go("guia")} />
            {template && (
              <div className="diagram-card">
                <div className="diagram-frame">
                  <ProcessDiagram templateId={template.id} L={diagramLabels} />
                </div>
                <div className="diagram-text">
                  <p>{template.description}</p>
                  <p className="muted small">Relación esperada con las variables originales:</p>
                  <p className="expected">
                    <MathText text={template.expected} />
                  </p>
                  {template.tip && <p className="muted small">💡 {template.tip}</p>}
                  <p className="muted small">
                    El esquema usa los símbolos de tu tabla: si quitas una variable, su cota desaparece.
                  </p>
                  {template.area === "Biorreactores y agitación" && (
                    <button className="btn btn-sm" onClick={() => go("simulador")}>
                      Ver este equipo en el simulador con control →
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="ws-grid">
              <section className="panel">
                <div className="panel-head">
                  <h2>
                    <span className="step">1</span> Variables del proceso
                  </h2>
                  <p className="muted small">
                    Marca con ● la variable que quieres predecir. Las unidades se escriben libremente (kg/m3, Pa·s,
                    W/(m²·K), rpm, cP, L/min…). Los valores son opcionales y sirven para calcular cada número.
                  </p>
                  <WhatIfBox templateId={p.templateId} />
                </div>
                <VariableTable
                  rows={p.rows}
                  dependentId={p.dependentId}
                  isolatedIds={analysis.isolatedIds}
                  onChange={updateRow}
                  onRemove={removeRow}
                  onAddKind={addKind}
                  onAddCustom={addCustom}
                  onDependent={(id) => update((cur) => ({ ...cur, dependentId: id, pinned: [] }))}
                  onMove={moveRow}
                />
                {Object.keys(built.unitErrors).length > 0 && (
                  <p className="alert alert-warn small">
                    Las variables con unidades no reconocidas no se incluyen en el análisis.
                  </p>
                )}
              </section>

              <section className="panel">
                <div className="panel-head panel-head-tabs">
                  <h2>
                    <span className="step">2</span> Grupos adimensionales
                  </h2>
                  <div className="tabs" role="tablist">
                    <button role="tab" aria-selected={tab === "resultado"} className={tab === "resultado" ? "active" : ""} onClick={() => setTab("resultado")}>
                      Resultado
                    </button>
                    <button role="tab" aria-selected={tab === "procedimiento"} className={tab === "procedimiento" ? "active" : ""} onClick={() => setTab("procedimiento")}>
                      Procedimiento
                    </button>
                  </div>
                </div>
                {tab === "resultado" ? (
                  <ResultsPanel
                    vars={built.vars}
                    analysis={analysis}
                    relation={relation}
                    dependentId={dependentId}
                    pinned={p.pinned}
                    onPin={(key) => update((cur) => ({ ...cur, pinned: [key, ...cur.pinned.filter((k) => k !== key)] }))}
                    onUnpin={(key) => update((cur) => ({ ...cur, pinned: cur.pinned.filter((k) => k !== key) }))}
                    onResetPins={() => update((cur) => ({ ...cur, pinned: [] }))}
                  />
                ) : (
                  <ProcedurePanel
                    vars={built.vars}
                    analysis={analysis}
                    manualRepeating={repeating}
                    onToggleRepeating={toggleRepeating}
                    onAutoRepeating={() => update((cur) => ({ ...cur, repeatingIds: [] }))}
                  />
                )}
              </section>
            </div>

            <section className="panel panel-scale">
              <div className="panel-head">
                <h2>
                  <span className="step">3</span> Datos experimentales y correlación
                </h2>
                <p className="muted small">
                  Captura tus mediciones y obtén la correlación Π₀ = C·Π₁ᵃ·Π₂ᵇ… que describe tu proceso.
                </p>
              </div>
              <DataPanel
                vars={built.vars}
                varRows={p.rows}
                relation={relation}
                templateId={p.templateId}
                data={p.data}
                correlation={correlation}
                onChange={(data) => update((cur) => ({ ...cur, data }))}
                notify={notify}
              />
            </section>

            <section className="panel panel-scale">
              <div className="panel-head">
                <h2>
                  <span className="step">4</span> Escalamiento: del laboratorio a la planta
                </h2>
                <p className="muted small">
                  Usa los grupos adimensionales para calcular cómo deben cambiar las variables al construir un equipo
                  más grande (o más pequeño) que se comporte igual.
                </p>
              </div>
              <ScalePanel
                vars={built.vars}
                rows={p.rows}
                relation={relation}
                templateId={p.templateId}
                scale={p.scale}
                onChange={(scale) => update((cur) => ({ ...cur, scale }))}
                correlation={correlation}
              />
            </section>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-logos">
          <img src="/img/itd.png" alt="Instituto Tecnológico de Durango" height={56} loading="lazy" />
          <img src="/img/mcibq.jpg" alt="Maestría en Ciencias en Ingeniería Bioquímica" height={56} loading="lazy" />
        </div>
        <p>
          <strong>PiLab</strong> · Desarrollado por <strong>{AUTHOR}</strong>
        </p>
        <p>
          {INSTITUTION} · {PROGRAM}
        </p>
        <p className="muted small">
          Teorema Π de Buckingham, similitud, correlaciones y control de procesos. Los cálculos se hacen en tu navegador con
          aritmética exacta.
        </p>
      </footer>

      {toast && <div className="toast" role="status">{toast}</div>}
      {authMode && <AuthDialog initial={authMode} onClose={() => setAuthMode(null)} />}
    </div>
  );
}
