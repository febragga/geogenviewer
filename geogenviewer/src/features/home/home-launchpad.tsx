"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Clock,
  FolderOpen,
  GitCompare,
  Layers,
  LayoutGrid,
  Ruler,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { ThemeToggle } from "../viewer/components/theme-toggle";
import { BrandMarkIcon } from "../viewer/components/icons";
import {
  GEOGEN_CONTRACT_VERSION,
  GEOGEN_VERSION_LABEL,
} from "../../lib/geogen/version";
import {
  clearRecentProjects,
  demoHrefFor,
  readRecentProjects,
  type RecentProjectRecord,
} from "./recent-projects";

type ShowcaseMode = "assembled" | "exploded" | "knolling";
type DocTopic = "guide" | "formats" | "exporter" | "privacy" | "limits" | "changelog";

interface DemoEntry {
  id: string;
  title: string;
  href: string;
  modeLabel: string;
  summary: string;
  capabilities: string[];
  visual: "structure" | "contract" | "pavilion" | "inspection" | "revision" | "catalog";
}

const DEMOS: DemoEntry[] = [
  {
    id: "pavilion",
    title: "Pavilhão desmontável",
    href: "/viewer?demo=pavilhao",
    modeLabel: "GLB + Manifesto",
    summary: "Estrutura sintética em 18 peças com etapas de montagem, instâncias e vista explodida.",
    capabilities: ["Explodir Z-up", "Montagem (6 etapas)", "Grupos sobrepostos"],
    visual: "pavilion",
  },
  {
    id: "catalog",
    title: "Laboratório de catálogo e knolling",
    href: "/viewer?demo=catalog",
    modeLabel: "Knolling + Fichas",
    summary: "15 ocorrências em duas revisões para disposição planar, miniaturas, callouts e pranchas A4/A3.",
    capabilities: ["Knolling XY/XZ/YZ", "Catálogo", "Manual imprimível"],
    visual: "catalog",
  },
  {
    id: "inspection",
    title: "Laboratório de inspeção",
    href: "/viewer?demo=inspecao",
    modeLabel: "Corte + Medição",
    summary: "Cubo de referência 100 mm, planos de corte em 3 eixos, snapping e captura técnica PNG.",
    capabilities: ["Clipping X/Y/Z", "Medição local", "PNG técnico"],
    visual: "inspection",
  },
  {
    id: "revision",
    title: "Comparação de protótipos",
    href: "/viewer?demo=revisao",
    modeLabel: "2 Revisões",
    summary: "Par de revisões sintéticas com alinhamento, resolução manual de pares e quantitativos.",
    capabilities: ["Diff em repouso", "Quantitativos", "Fabricação"],
    visual: "revision",
  },
  {
    id: "contract",
    title: "Contrato v1.0.0",
    href: "/viewer?demo=contrato",
    modeLabel: "Referência CAD",
    summary: "Exemplo executável do manifesto CAD com cubo de 100 mm, proveniências e UserText.",
    capabilities: ["SHA-256", "Proveniência CAD", "Camadas e tipos"],
    visual: "contract",
  },
  {
    id: "basic",
    title: "Estrutura básica (GLB-only)",
    href: "/viewer?demo=1",
    modeLabel: "GLB Básico",
    summary: "8 componentes sem manifesto JSON para testar grupos e camadas personalizados do usuário.",
    capabilities: ["Camadas do usuário", "Grupos do usuário", "Sem manifesto"],
    visual: "structure",
  },
];

const DOC_TOPICS: { id: DocTopic; label: string }[] = [
  { id: "guide", label: "Guia rápido" },
  { id: "formats", label: "Formatos suportados" },
  { id: "exporter", label: "GeoGenExporter" },
  { id: "privacy", label: "Privacidade" },
  { id: "limits", label: "Limitações" },
  { id: "changelog", label: "Changelog" },
];

function DemoThumb({ kind }: { kind: DemoEntry["visual"] }) {
  if (kind === "knolling" as never || kind === "catalog") {
    return (
      <svg viewBox="0 0 160 88" className="gg-demo-thumb" aria-hidden="true">
        <rect x="14" y="14" width="38" height="24" rx="2" className="gg-svg-part" />
        <rect x="60" y="14" width="38" height="24" rx="2" className="gg-svg-part gg-svg-part--accent" />
        <rect x="106" y="14" width="38" height="24" rx="2" className="gg-svg-part" />
        <rect x="14" y="48" width="58" height="24" rx="2" className="gg-svg-part" />
        <rect x="80" y="48" width="64" height="24" rx="2" className="gg-svg-part" />
      </svg>
    );
  }
  if (kind === "inspection") {
    return (
      <svg viewBox="0 0 160 88" className="gg-demo-thumb" aria-hidden="true">
        <rect x="38" y="20" width="44" height="44" className="gg-svg-part" />
        <rect x="92" y="24" width="32" height="36" className="gg-svg-part gg-svg-part--accent" />
        <line x1="22" y1="44" x2="142" y2="44" className="gg-svg-guide" />
        <line x1="38" y1="72" x2="82" y2="72" className="gg-svg-measure" />
      </svg>
    );
  }
  if (kind === "revision") {
    return (
      <svg viewBox="0 0 160 88" className="gg-demo-thumb" aria-hidden="true">
        <rect x="20" y="20" width="48" height="48" className="gg-svg-part" />
        <rect x="92" y="20" width="48" height="48" className="gg-svg-part gg-svg-part--accent" />
        <line x1="74" y1="44" x2="86" y2="44" className="gg-svg-measure" />
      </svg>
    );
  }
  if (kind === "contract" || kind === "structure") {
    return (
      <svg viewBox="0 0 160 88" className="gg-demo-thumb" aria-hidden="true">
        <polygon points="34,30 80,14 126,30 80,46" className="gg-svg-part gg-svg-part--accent" />
        <rect x="44" y="44" width="10" height="30" className="gg-svg-part" />
        <rect x="106" y="44" width="10" height="30" className="gg-svg-part" />
        <rect x="74" y="48" width="12" height="26" className="gg-svg-part" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 160 88" className="gg-demo-thumb" aria-hidden="true">
      <polygon points="30,26 80,12 130,26 80,40" className="gg-svg-part gg-svg-part--accent" />
      <line x1="80" y1="12" x2="80" y2="76" className="gg-svg-guide" />
      <rect x="38" y="42" width="12" height="30" className="gg-svg-part" />
      <rect x="74" y="42" width="12" height="30" className="gg-svg-part" />
      <rect x="110" y="42" width="12" height="30" className="gg-svg-part" />
      <rect x="32" y="72" width="96" height="6" className="gg-svg-part" />
    </svg>
  );
}

function GeometricShowcase() {
  const [mode, setMode] = useState<ShowcaseMode>("exploded");

  const slabOffset = mode === "assembled" ? 0 : mode === "exploded" ? -18 : 0;
  const beamOffset = mode === "assembled" ? 0 : mode === "exploded" ? -8 : 0;
  const pillarShift = mode === "exploded" ? 8 : 0;

  return (
    <aside className="gg-showcase" aria-label="Demonstração geométrica sintética">
      <div className="gg-showcase__head">
        <span className="gg-technical-label gg-section-index">
          Fixture sintética · Pavilhão &amp; Knolling
        </span>
        <div className="gg-showcase__modes" role="group" aria-label="Estado da prévia">
          {(
            [
              ["assembled", "Montado"],
              ["exploded", "Explodido"],
              ["knolling", "Knolling"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className="gg-seg-btn"
              aria-pressed={mode === key}
              onClick={() => setMode(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="gg-showcase__canvas">
        <svg viewBox="0 0 420 260" className="gg-showcase__svg" role="img" aria-label="Representação técnica de estrutura desmontável">
          {/* Reference CAD Grid */}
          <g className="gg-showcase-grid">
            <path d="M 30 198 L 210 248 L 390 198 L 210 148 Z" />
            <line x1="120" y1="173" x2="300" y2="223" />
            <line x1="120" y1="223" x2="300" y2="173" />
          </g>

          {mode === "knolling" ? (
            <g className="gg-showcase-knolling">
              {/* Planar organized components */}
              <rect x="44" y="48" width="110" height="58" rx="3" className="gg-svg-part gg-svg-part--accent" />
              <rect x="172" y="48" width="96" height="22" rx="3" className="gg-svg-part" />
              <rect x="172" y="84" width="96" height="22" rx="3" className="gg-svg-part" />
              <rect x="288" y="48" width="32" height="78" rx="3" className="gg-svg-part" />
              <rect x="332" y="48" width="32" height="78" rx="3" className="gg-svg-part" />
              <rect x="44" y="138" width="32" height="72" rx="3" className="gg-svg-part" />
              <rect x="88" y="138" width="32" height="72" rx="3" className="gg-svg-part" />
              <rect x="142" y="148" width="128" height="52" rx="3" className="gg-svg-part gg-svg-part--accent" />
              <rect x="292" y="156" width="36" height="36" rx="3" className="gg-svg-part" />
              <g className="gg-showcase-callout">
                <line x1="99" y1="48" x2="112" y2="30" />
                <rect x="112" y="18" width="76" height="18" rx="3" />
                <text x="120" y="31">L-01 · LAJE</text>
              </g>
              <g className="gg-showcase-callout">
                <line x1="220" y1="48" x2="232" y2="30" />
                <rect x="232" y="18" width="84" height="18" rx="3" />
                <text x="240" y="31">V-01 · VIGA ×2</text>
              </g>
            </g>
          ) : (
            <g>
              {/* Foundation plate */}
              <polygon points="96,192 210,224 324,192 210,160" className="gg-svg-part" />

              {/* Explode dashed guides */}
              {mode === "exploded" && (
                <g className="gg-svg-guide">
                  <line x1="138" y1="176" x2="138" y2="76" />
                  <line x1="282" y1="176" x2="282" y2="76" />
                  <line x1="210" y1="196" x2="210" y2="54" />
                </g>
              )}

              {/* Left & Right Pillars */}
              <g transform={`translate(${-pillarShift}, 0)`}>
                <polygon points="128,112 142,116 142,174 128,170" className="gg-svg-part" />
                <polygon points="142,116 152,112 152,170 142,174" className="gg-svg-part" />
              </g>
              <g transform={`translate(${pillarShift}, 0)`}>
                <polygon points="268,112 282,116 282,174 268,170" className="gg-svg-part" />
                <polygon points="282,116 292,112 292,170 282,174" className="gg-svg-part" />
              </g>

              {/* Beams */}
              <g transform={`translate(0, ${beamOffset})`}>
                <polygon points="122,98 210,122 298,98 210,74" className="gg-svg-part" />
              </g>

              {/* Roof slab */}
              <g transform={`translate(0, ${slabOffset})`}>
                <polygon points="104,76 210,106 316,76 210,46" className="gg-svg-part gg-svg-part--accent" />
                <polygon points="104,76 210,106 210,116 104,86" className="gg-svg-part" />
                <polygon points="210,106 316,76 316,86 210,116" className="gg-svg-part" />
              </g>

              {/* Callouts */}
              <g className="gg-showcase-callout">
                <circle cx="246" cy={72 + slabOffset} r="3" />
                <line x1="246" y1={72 + slabOffset} x2="294" y2={38 + slabOffset * 0.4} />
                <rect x="294" y={25 + slabOffset * 0.4} width="102" height="20" rx="3" />
                <text x="302" y={39 + slabOffset * 0.4}>Laje · L-01</text>
              </g>
              <g className="gg-showcase-callout">
                <circle cx={136 - pillarShift} cy="144" r="3" />
                <line x1={136 - pillarShift} y1="144" x2="72" y2="144" />
                <rect x="16" y="134" width="84" height="20" rx="3" />
                <text x="24" y="148">Pilar · P-01</text>
              </g>
            </g>
          )}
        </svg>
      </div>

      <div className="gg-showcase__foot">
        <span className="gg-mono">GLB 2.0 + JSON {GEOGEN_CONTRACT_VERSION} · WebGL único</span>
        <Link
          href={mode === "knolling" ? "/viewer?demo=catalog" : "/viewer?demo=pavilhao"}
          className="gg-showcase__link"
        >
          <span>Abrir no visualizador</span>
          <ArrowRight size={13} strokeWidth={1.75} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}

const EMPTY_RECENTS: RecentProjectRecord[] = [];
let cachedRecentKey = "__init__";
let cachedRecents: RecentProjectRecord[] = EMPTY_RECENTS;

function subscribeRecents(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("geogen-recent-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("geogen-recent-change", callback);
  };
}

function getRecentsSnapshot(): RecentProjectRecord[] {
  try {
    const raw = window.localStorage.getItem("geogen:v09:recent-projects") ?? "";
    if (raw !== cachedRecentKey) {
      cachedRecentKey = raw;
      cachedRecents = readRecentProjects();
    }
    return cachedRecents;
  } catch {
    return EMPTY_RECENTS;
  }
}

export function HomeLaunchpad() {
  const recent = useSyncExternalStore(
    subscribeRecents,
    getRecentsSnapshot,
    () => EMPTY_RECENTS
  );
  const [docTopic, setDocTopic] = useState<DocTopic>("guide");

  return (
    <div className="gg-home-shell">
      <header className="gg-home-header">
        <div className="gg-brand">
          <BrandMarkIcon className="gg-brand__mark" />
          <span className="gg-brand__name">GeoGenViewer</span>
          <span className="gg-badge gg-badge--accent gg-mono">{GEOGEN_VERSION_LABEL}</span>
        </div>

        <nav className="gg-home-nav" aria-label="Navegação principal">
          <a href="#demo-library" className="gg-home-nav__link">
            Demonstrações
          </a>
          <a href="#documentacao" className="gg-home-nav__link">
            Documentação
          </a>
          <Link href="/viewer" className="gg-home-nav__link gg-home-nav__link--viewer">
            Visualizador
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <main className="gg-home-main">
        {/* Hero */}
        <section className="gg-home-hero" aria-labelledby="gg-hero-title">
          <div className="gg-home-hero__copy">
            <p className="gg-section-index gg-technical-label">
              Geometria computacional · Fabricação digital
            </p>
            <h1 id="gg-hero-title" className="gg-home-hero__title">
              Da geometria à montagem.
            </h1>
            <p className="gg-home-hero__lead">
              Visualize, inspecione, compare revisões, organize em grupos e camadas personalizadas,
              gere knolling e produza documentação técnica diretamente no navegador — com
              processamento 100% local.
            </p>

            <div className="gg-home-actions">
              <Link href="/viewer?open=1" className="gg-btn gg-btn--primary">
                <FolderOpen size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Abrir modelo local</span>
              </Link>
              <a href="#demo-library" className="gg-btn gg-btn--secondary">
                <LayoutGrid size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Explorar demonstrações</span>
              </a>
              <Link href="/viewer?demo=pavilhao" className="gg-btn gg-btn--ghost">
                <Boxes size={15} strokeWidth={1.75} aria-hidden="true" />
                <span>Pavilhão demo</span>
              </Link>
            </div>

            <dl className="gg-home-capabilities">
              <div>
                <dt>
                  <ShieldCheck size={14} strokeWidth={1.75} aria-hidden="true" />
                  Privacidade local
                </dt>
                <dd>Nenhum GLB ou manifesto é enviado para servidores externos.</dd>
              </div>
              <div>
                <dt>
                  <Layers size={14} strokeWidth={1.75} aria-hidden="true" />
                  Organização do usuário
                </dt>
                <dd>Camadas hierárquicas e grupos sobrepostos mesmo em GLB sem manifesto.</dd>
              </div>
              <div>
                <dt>
                  <Ruler size={14} strokeWidth={1.75} aria-hidden="true" />
                  Inspeção e documentação
                </dt>
                <dd>Cortes em 3 eixos, medições, fichas A4/A3, knolling e catálogo.</dd>
              </div>
            </dl>
          </div>

          <GeometricShowcase />
        </section>

        {/* Demo Library */}
        <section id="demo-library" className="gg-home-section" aria-labelledby="gg-demo-heading">
          <div className="gg-home-section__head">
            <div>
              <p className="gg-section-index gg-technical-label">Fixtures sintéticas</p>
              <h2 id="gg-demo-heading" className="gg-home-section__title">
                Biblioteca de demonstrações
              </h2>
            </div>
            <span className="gg-home-section__meta">
              Modelos sintéticos públicos para teste imediato em desktop e tablet
            </span>
          </div>

          <div className="gg-demo-grid">
            {DEMOS.map((demo) => (
              <Link key={demo.id} href={demo.href} className="gg-demo-card">
                <DemoThumb kind={demo.visual} />
                <div className="gg-demo-card__body">
                  <div className="gg-demo-card__top">
                    <h3>{demo.title}</h3>
                    <span className="gg-badge gg-badge--neutral gg-mono">{demo.modeLabel}</span>
                  </div>
                  <p>{demo.summary}</p>
                  <div className="gg-demo-card__chips">
                    {demo.capabilities.map((cap) => (
                      <span key={cap} className="gg-badge gg-badge--accent">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent Projects (lightweight metadata only) */}
        <section className="gg-home-section" aria-labelledby="gg-recent-heading">
          <div className="gg-home-section__head">
            <div>
              <p className="gg-section-index gg-technical-label">Sessão local</p>
              <h2 id="gg-recent-heading" className="gg-home-section__title">
                Projetos recentes
              </h2>
            </div>
            {recent.length > 0 && (
              <button
                type="button"
                className="gg-btn gg-btn--ghost gg-btn--xs"
                onClick={() => {
                  clearRecentProjects();
                  window.dispatchEvent(new Event("geogen-recent-change"));
                }}
              >
                <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
                <span>Limpar histórico</span>
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <p className="gg-home-empty">
              Nenhum acesso recente registrado neste navegador. Apenas metadados leves (nome, revisão e
              data) são salvos localmente — arquivos GLB privados nunca são armazenados automaticamente.
            </p>
          ) : (
            <div className="gg-recent-grid">
              {recent.map((item) => (
                <Link
                  key={item.key}
                  href={demoHrefFor(item.demoKind)}
                  className="gg-recent-card"
                >
                  <div className="gg-recent-card__head">
                    <strong>{item.title}</strong>
                    <span className="gg-badge gg-badge--neutral gg-mono">
                      {item.revisionId ?? (item.mode === "manifest-full" ? "Manifesto" : "GLB")}
                    </span>
                  </div>
                  <span className="gg-recent-card__meta gg-mono">
                    {item.fileName} · {item.componentCount} peças
                    {item.sha256Prefix ? ` · ${item.sha256Prefix}` : ""}
                  </span>
                  <span className="gg-recent-card__time">
                    <Clock size={12} strokeWidth={1.75} aria-hidden="true" />
                    <span>
                      {new Date(item.lastOpenedAt).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="gg-recent-card__action">
                      {item.demoKind ? "Abrir demo" : "Selecionar arquivo local"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Compact Documentation & Contract Reference */}
        <section id="documentacao" className="gg-home-section" aria-labelledby="gg-doc-heading">
          <div className="gg-home-section__head">
            <div>
              <p className="gg-section-index gg-technical-label">Referência técnica</p>
              <h2 id="gg-doc-heading" className="gg-home-section__title">
                Documentação e contrato
              </h2>
            </div>
            <div className="gg-doc-tabs" role="tablist" aria-label="Tópicos de documentação">
              {DOC_TOPICS.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  role="tab"
                  className="gg-tab"
                  aria-selected={docTopic === topic.id}
                  onClick={() => setDocTopic(topic.id)}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          <div className="gg-doc-panel" role="tabpanel" aria-label={DOC_TOPICS.find((t) => t.id === docTopic)?.label}>
            {docTopic === "guide" && (
              <div className="gg-doc-columns">
                <div>
                  <h3>1. Abrir modelos locais ou demonstrações</h3>
                  <p>
                    Carregue um arquivo <code>.glb</code> isoladamente (modo básico) ou em conjunto com seu{" "}
                    <code>manifest.json</code> v{GEOGEN_CONTRACT_VERSION}. Todos os dados permanecem no dispositivo.
                  </p>
                </div>
                <div>
                  <h3>2. Explorar, organizar e documentar</h3>
                  <p>
                    Use o menu de workspaces no topo (<code>Explorar</code>, <code>Explodir</code>,{" "}
                    <code>Montagem</code>, <code>Inspecionar</code>, <code>Comparar</code>,{" "}
                    <code>Quantitativos</code>, <code>Knolling</code> e <code>Catálogo</code>) ou abra a paleta
                    com <kbd>Ctrl+K</kbd>.
                  </p>
                </div>
                <div>
                  <h3>3. Navegação 3D e teclado</h3>
                  <p>
                    Arraste para orbitar, clique no Navigation Cube para orientações exatas e pressione{" "}
                    <kbd>F</kbd> (enquadrar), <kbd>R</kbd> (redefinir), <kbd>V</kbd> (4 vistas) ou <kbd>J</kbd>{" "}
                    (modo limpo).
                  </p>
                </div>
              </div>
            )}

            {docTopic === "formats" && (
              <div className="gg-doc-columns">
                <div>
                  <h3>glTF 2.0 Binário (.glb)</h3>
                  <p>
                    Malhas tesselladas em espaço Y-up (metros), autocontidas, sem buffers/imagens externos e
                    até 100 MiB por arquivo. Modelos com ocorrências repetidas utilizam batching GPU automático.
                  </p>
                </div>
                <div>
                  <h3>Manifesto CAD v{GEOGEN_CONTRACT_VERSION}</h3>
                  <p>
                    JSON validado por schema estrito (layers, grupos, materiais, dimensões com proveniência,
                    etapas de montagem e verificação opcional SHA-256).
                  </p>
                </div>
                <div>
                  <h3>Organização e documentos auxiliares</h3>
                  <p>
                    <code>organization.json</code> v1.0.0 persiste camadas e grupos criados pelo usuário, além dos
                    schemas independentes de inspeção (V0.6), comparação/fabricação (V0.7) e documentação (V0.8).
                  </p>
                </div>
              </div>
            )}

            {docTopic === "exporter" && (
              <div className="gg-doc-columns">
                <div>
                  <h3>GeoGenExporter (Rhino 8 / Python)</h3>
                  <p>
                    Em desenvolvimento paralelo para RhinoCommon (contrato CAD {GEOGEN_CONTRACT_VERSION},
                    conversão de eixos <code>(x, z, -y)</code> e vínculo via <code>extras.geogenElementId</code>).
                  </p>
                </div>
                <div>
                  <h3>Status de homologação</h3>
                  <p>
                    O pacote do plugin ainda aguarda homologação prática em Rhino 8 e por isso não há download de
                    instalador publicado nesta versão. O visualizador opera plenamente com GLBs de outras origens.
                  </p>
                </div>
              </div>
            )}

            {docTopic === "privacy" && (
              <div className="gg-doc-columns">
                <div>
                  <h3>Processamento 100% no navegador</h3>
                  <p>
                    Arquivos abertos em <code>/viewer</code> nunca são enviados pela rede. Referências externas em
                    GLBs são bloqueadas e textos importados são sanitizados contra execução de scripts ou CSV
                    injection.
                  </p>
                </div>
                <div>
                  <h3>Dados da Casa Gerassi protegidos</h3>
                  <p>
                    Nenhuma geometria privada da pesquisa acadêmica é versionada em <code>public/</code> ou no
                    histórico recente.
                  </p>
                </div>
              </div>
            )}

            {docTopic === "limits" && (
              <div className="gg-doc-columns">
                <div>
                  <h3>Escopo explícito</h3>
                  <p>
                    O GeoGenViewer não executa edição NURBS, análise estrutural, validação física de tolerâncias de
                    encaixe nem substitui CAD/BIM completos. Medições sobre malha GLB são aproximadas e exibem sua
                    proveniência.
                  </p>
                </div>
                <div>
                  <h3>Homologações pendentes</h3>
                  <p>
                    Testes em tablet físico real, execução prática do GeoGenExporter no Rhino 8 e validação com
                    arquivo autorizado da Casa Gerassi permanecem pendentes antes da V1.0.
                  </p>
                </div>
              </div>
            )}

            {docTopic === "changelog" && (
              <div className="gg-doc-columns">
                <div>
                  <h3>{GEOGEN_VERSION_LABEL} · Atual</h3>
                  <p>
                    Nova identidade triangular (#3B82F6), nova home launchpad, Navigation Cube 3D sólido, sistema
                    de grupos e camadas personalizadas com undo/redo e persistência, instancing GPU e refinamento de UX.
                  </p>
                </div>
                <div>
                  <h3>v0.8.0 · v0.7.0 · v0.6.0</h3>
                  <p>
                    Knolling, Catálogo e fichas A4/A3 (V0.8); Comparação de revisões e Quantitativos (V0.7); Cortes,
                    snapping e medições espaciais (V0.6).
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="gg-home-footer">
        <div className="gg-home-footer__left">
          <BookOpen size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>
            GeoGenViewer {GEOGEN_VERSION_LABEL} · Estudo de caso inicial: maquete desmontável da Casa Gerassi
            (pesquisa FAU-USP · sem dados privados publicados).
          </span>
        </div>
        <div className="gg-home-footer__right gg-mono">
          <GitCompare size={13} strokeWidth={1.75} aria-hidden="true" />
          <span>Contrato CAD v{GEOGEN_CONTRACT_VERSION}</span>
        </div>
      </footer>
    </div>
  );
}
