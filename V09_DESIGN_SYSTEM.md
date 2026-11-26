# GeoGenViewer V0.9 — Design System

**Versão:** v0.9.0 · **Data:** 2026-11-26 · **Base:** `febragga/portfolio` + `DESIGN_SYSTEM.md`

---

## 1. Direção Estética e Princípios

O sistema visual do **GeoGenViewer v0.9.0** combina a precisão editorial arquitetônica do portfólio `fernandobragaportfolio.com.br` com a ergonomia operacional de softwares CAD/BIM modernos:

- **Superfícies neutras com alto contraste:** Modo escuro calibrado (`#0c0d0e`, `#17191a`, `#202223`) e modo claro estilo prancheta técnica (`#e6eaf0`, `#edf0f3`, `#f8f9fb`), alternados via `light-dark()` e `<meta name="color-scheme">`.
- **Azul primário de marca (`#3B82F6`):** Aplicado ao símbolo triangular geométrico, foco ativo de seleção, destaques do Cubo de Navegação 3D e botões primários. Acentos complementares `--gg-accent` (`#1d5f82` claro / `#b5daf2` escuro) preservam legibilidade WCAG AA nos painéis.
- **Tipografia dual:** `Geist` (`--gg-font-sans`) para interface e `Geist Mono` (`--gg-font-mono`) com `tabular-nums` para medidas, IDs, contagens e versões.
- **Hierarquia espacial:** Canvas 3D ocupa o centro com painéis retráteis/redimensionáveis (`react-resizable-panels`), bottom sheet tátil em smartphones (`vaul`), popovers acessíveis (`@base-ui/react`) e paleta de comandos (`cmdk`).

---

## 2. Tokens Principais (`geogenviewer/app/globals.css` e `app/home.css`)

| Categoria | Token | Modo Claro | Modo Escuro | Uso |
|---|---|---|---|---|
| Fundo app | `--gg-bg-app` | `#e6eaf0` | `#0c0d0e` | Shell geral |
| Viewport | `--gg-bg-viewport` | `#edf0f3` | `#101214` | Fundo padrão da cena (sobrescrevível por Configurações) |
| Painéis | `--gg-bg-panel` | `#f8f9fb` | `#17191a` | Drawers, topbar, diálogos |
| Superfície sutil | `--gg-bg-subtle` | `#edf0f3` | `#202223` | Inputs, abas inativas, grupos |
| Borda estrutural | `--gg-border-subtle` | `#d3dae3` | `#343637` | Divisórias de 1px |
| Texto principal | `--gg-text-primary` | `#111315` | `#f1f1ee` | Títulos e valores |
| Texto secundário | `--gg-text-muted` | `#525b66` | `#949897` | Metadados e IDs |
| Marca | `GEOGEN_BRAND_BLUE` | `#3B82F6` | `#3B82F6` | Logo triangular, cubo ativo, realces |
| Alvo mínimo | `--gg-target-size` | `32px` (desktop) / `44px` (touch) | idem | Ergonomia desktop e tablet |

---

## 3. Componentes Estruturais Refinados na V0.9

1. **Home Launchpad (`src/features/home/home-launchpad.tsx` + `app/home.css`):**
   - Header fixo compacto com marca triangular, badge `v0.9.0`, navegação por âncoras, GitHub e alternador de tema.
   - Hero assimétrico (*"Da geometria à montagem."*) com showcase interativo (`Montado` / `Explodido` / `Knolling`), CTAs diretos e métricas do contrato.
   - Biblioteca de 6 demonstrações sintéticas em grade responsiva, lista de **Projetos Recentes** (apenas metadados locais, sem armazenamento de arquivos completos) e documentação técnica em abas.
2. **Topbar e Navegação de Workspaces (`viewer-topbar.tsx`):**
   - Agrupamento em 4 famílias claras: **Visualização** (`Explorar`, `Explodir`, `Montagem`), **Inspeção** (`Inspecionar`), **Análise** (`Comparar`, `Quantitativos`) e **Documentação** (`Knolling`, `Catálogo`).
   - Em viewports amplos (`>= 1280px`), botões rápidos de família sincronizados com o `<select aria-label="Workspace">` acessível.
3. **Cubo de Navegação 3D Sólido (`navigation-cube.tsx`):**
   - Poliedro chanfrado sólido em SVG (`viewBox="0 0 100 100"`) com iluminação direcional sutil, 26 faces/arestas/cantos interativos e barra auxiliar (`Home`, `-90°`, `+90°`, `Persp./Orto.`).
4. **Menu de Contexto e Organização (`context-menu.tsx`, `viewer-panels.tsx`):**
   - Menu flutuante acessível por botão direito na cena 3D ou na árvore e por botão tátil `⋮` em cada item.
   - Modal nativo `<dialog>` para escolha explícita ao excluir camada personalizada.
5. **Diálogo Consolidado de Configurações (`settings-dialog.tsx` + `settings-store.ts`):**
   - 5 abas (`Aparência`, `Navegação`, `Desempenho`, `Unidades e dados`, `Sobre`) respaldadas por store persistida (`geogen:v09:settings`).
