# GeoGenViewer — design system

**Revisão:** 0.2 · 25/11/2026 (Sprint 02.1 — alinhamento ao portfólio [febragga/portfolio](https://github.com/febragga/portfolio))  
**Responsável:** Antigravity (Product Design & Frontend Engineering)  
**Base técnica implementada:** Next.js `16.4.6` · React `19.3.0` · CSS puro com `light-dark()` + `<meta name="color-scheme">` em [layout.tsx](file:///C:/Site-GeoGenViewer/geogenviewer/app/layout.tsx) e [globals.css](file:///C:/Site-GeoGenViewer/geogenviewer/app/globals.css) · Primitivos `@base-ui/react` + ícones `lucide-react`.

---

## 1. Identidade e princípios visuais

O GeoGenViewer adota uma linguagem visual **técnica, neutra e silenciosa**, projetada para que a geometria arquitetônica (madeira, concreto, PLA, juntas, eixos e seleção) seja o único protagonista cromático da tela.

### Diretrizes inegociáveis

1. **Neutralidade de fundo e chrome:** superfícies em cinza-ardósia neutro; o azul-claro/azul-acinzentado atua exclusivamente como sinal de foco, seleção, estado ativo e ação primária.
2. **Sem estética genérica de SaaS:** evitar gradientes vibrantes, sombras difusas exageradas, cartões decorativos redundantes, bordas super arredondadas ou animações ornamentais.
3. **Contraste técnico legível:** bordas nítidas de `1px` definem fronteiras entre viewport e painéis; texto secundário e metadados devem atender WCAG AA (`>= 4.5:1`).
4. **Precisão numérica:** medidas, escalas (`1:50`), IDs e versões sempre alinhados com algarismos tabulares e fontes monoespaçadas.
5. **Dualidade Claro / Escuro:** suporte planejado e equivalente para ambos os temas desde os tokens iniciais, com alternância manual e respeito à preferência do sistema.

---

## 2. Sistema de cores e tokens semânticos

Os tokens são definidos via CSS Custom Properties em `geogenviewer/app/globals.css` utilizando `light-dark()` vinculado a `<meta name="color-scheme" content="light dark">` (com alternância manual persistida em `localStorage` sob `geogen-color-scheme`), mantendo paridade visual com o portfólio de Fernando Braga (`#0C0D0E` / `#17191A` / `#202223` / `#B5DAF2` em Dark e prancha técnica `#EDF0F3` em Light).

### 2.1 Paleta de marca e destaque (Azul-gelo / Azul-aço)

- **Tema Claro — Acento Técnico (Steel Blue calibrado WCAG AA):**
  - `--gg-accent`: `#1D5F82` (contraste >= 5.2:1 sobre `#F8F9FB`, `#EDF0F3` e superfícies de badge)
  - `--gg-accent-hover`: `#154A66`
  - `--gg-accent-ink`: `#FFFFFF`
  - `--gg-accent-soft`: `rgba(29, 95, 130, 0.10)`
  - `--gg-accent-border`: `rgba(29, 95, 130, 0.44)`
- **Tema Escuro — Acento Azul-gelo (Portfolio Ice Blue):**
  - `--gg-accent`: `#B5DAF2` (idêntico a `--color-accent` em `febragga/portfolio`)
  - `--gg-accent-hover`: `#89C8FA` (idêntico a `--color-accent-interactive`)
  - `--gg-accent-ink`: `#0C0D0E`
  - `--gg-accent-soft`: `rgba(181, 218, 242, 0.13)`
  - `--gg-accent-border`: `rgba(181, 218, 242, 0.42)`

### 2.2 Superfícies, bordas e texto

| Token | Tema Claro | Tema Escuro | Uso semântico |
|---|---|---|---|
| `--gg-bg-app` | `#E6EAF0` | `#0C0D0E` | Fundo base da aplicação |
| `--gg-bg-viewport` | `#EDF0F3` | `#101214` | Fundo do canvas WebGL (prancha clara / estúdio grafite) |
| `--gg-bg-panel` | `#F8F9FB` | `#17191A` | Topbar, painéis laterais e modais |
| `--gg-bg-elevated` | `rgba(255, 255, 255, 0.96)` | `rgba(23, 25, 26, 0.96)` | Toolbars flutuantes e badge de eixos |
| `--gg-bg-subtle` | `#EDF0F3` | `#202223` | Inputs, badges neutros, hover leve |
| `--gg-bg-active` | `#DFE5ED` | `#2A2D2F` | Estado ativo / hover pressionado |
| `--gg-border-subtle` | `#D3DAE3` | `#343637` | Divisórias `1px` de painéis e seções |
| `--gg-border-strong` | `#B4BFCE` | `rgba(241, 241, 238, 0.24)` | Bordas de controles, separadores e popups |
| `--gg-text-primary` | `#111315` | `#F1F1EE` | Títulos, valores de medida, itens ativos |
| `--gg-text-secondary` | `#3F4752` | `#B4B8B7` | Rótulos de propriedades, subtítulos, ícones padrão |
| `--gg-text-muted` | `#525B66` | `#949897` | Metadados auxiliares (calibrado >= 4.5:1 AA) |

### 2.3 Estados semânticos e cena 3D

| Token | Claro | Escuro | Uso |
|---|---|---|---|
| `--gg-status-success` | `#1F7A4C` | `#4ADE80` | Manifesto validado, carga concluída |
| `--gg-status-warning` | `#B45309` | `#FBBF24` | Modo GLB básico, divergência não bloqueante, heurística visual |
| `--gg-status-danger` | `#B91C1C` | `#F87171` | Arquivo inválido, falha de schema, WebGL perdido |
| `--gg-scene-selection` | `#256F96` | `#67B7E1` | Destaque/contorno do elemento selecionado no 3D |
| `--gg-scene-hover` | `#5BAAD4` | `#93CFEB` | Destaque sutil ao passar o ponteiro (desktop) |
| `--gg-scene-grid-major` | `#C7CFD9` | `#2E3643` | Linhas principais da grade de referência |
| `--gg-scene-grid-minor` | `#DCE1E8` | `#202630` | Subdivisões da grade de referência |
| `--gg-axis-x` / `y` / `z` | `#C94A4A` / `#3D8B5E` / `#3B79B8` | `#E06C6C` / `#57B07C` / `#5BAAD4` | Eixos de referência espacial (RGB padrão de CAD com saturação suavizada) |

### 2.4 Integração recomendada com `globals.css` (Tailwind v4)

O projeto recém-criado já usa Tailwind v4 (`@import "tailwindcss";` e `@theme inline`). A implementação futura deve mapear os tokens acima dentro de `@theme inline` (ex.: `--color-panel: var(--gg-bg-panel); --color-accent: var(--gg-accent);`) e controlar o tema via atributo `data-theme="light" | "dark"` no `<html>` (respeitando `prefers-color-scheme` como padrão inicial caso não haja preferência salva localmente).

---

## 3. Tipografia

O template em [layout.tsx](file:///C:/Site-GeoGenViewer/geogenviewer/app/layout.tsx) já carrega `Geist` (`--font-geist-sans`) e `Geist_Mono` (`--font-geist-mono`) via `next/font/google` — excelente escolha de alta legibilidade técnica sem adicionar dependências externas. **Atenção:** remover a regra residual `font-family: Arial, Helvetica, sans-serif;` no `body` de [globals.css](file:///C:/Site-GeoGenViewer/geogenviewer/app/globals.css) quando a UI começar a ser implementada, para que `--font-sans` seja aplicada de fato.

| Papel tipográfico | Família | Tamanho / Altura | Peso | Uso |
|---|---|---|---|---|
| **Display / Home Title** | `Geist Sans` | `24px–32px` / `1.2` | `600` | Apenas na página inicial `/` |
| **Project Title (Topbar)** | `Geist Sans` | `14px` / `1.25` | `600` | Nome do projeto ou arquivo aberto no `/viewer` |
| **Panel Header** | `Geist Sans` | `12px` / `1.3` | `600` | Cabeçalhos de Árvore e Inspetor (`tracking-[0.02em]`) |
| **Body / Control** | `Geist Sans` | `13px` / `1.4` | `500` / `400` | Botões, menus, mensagens de erro e empty states |
| **Tree / Inspector Row** | `Geist Sans` | `12px` / `1.35` | `400` / `500` | Nós da hierarquia, layers, pares chave-valor |
| **Micro / Provenance** | `Geist Sans` | `11px` / `1.2` | `500` | Badges (`CAD`, `Malha`, `Básico`), hints |
| **Technical / Mono** | `Geist Mono` | `11px–12px` / `1.35` | `400` / `500` | IDs (`demo-p01`), dimensões (`100,0 mm`), `1:50`, atalhos (`F`), versão |

Regra obrigatória para números: aplicar `tabular-nums` (`font-variant-numeric: tabular-nums`) em qualquer medida, contador, porcentagem de carregamento ou scrubber temporal para evitar tremor horizontal durante mudanças de valor.

---

## 4. Espaçamento, densidade, superfícies e bordas

- **Unidade base:** `4px`. Escala principal: `4, 6, 8, 12, 16, 20, 24, 32`.
- **Densidade adaptativa (Desktop vs Touch):**
  - **Desktop (`pointer: fine`):** botões de toolbar `32×32px` (ou `36×36px`), linhas de árvore `28px`, topbar `44px`.
  - **Tablet / Mobile (`pointer: coarse` ou viewport `< 1024px`):** alvos interativos mínimos de **`44×44 CSS px`** (inclusive área clicável estendida em ícones compactos de olho/visibilidade e alça de bottom sheet), linhas de árvore `40–44px`, topbar `48px`.
- **Raios de borda:**
  - `4px`: itens de árvore, badges de proveniência, teclas de atalho.
  - `6px`: botões padrão, inputs de busca, controles de segmento.
  - `8px`: toolbars flutuantes, menus dropdown, tooltips.
  - `12px`: modais de importação/diagnóstico e canto superior de bottom sheets.
- **Elevação e translucidez:**
  - Painéis acoplados (Topbar, drawers fixos) usam **fundo opaco + borda de `1px`** (sem `backdrop-blur`, garantindo legibilidade máxima e economia de GPU).
  - Toolbars flutuantes sobre o canvas usam fundo elevado com leve translucidez (`92%` opacidade) + borda `--gg-border-subtle` + sombra sutil (`0 4px 16px rgba(0,0,0,0.08)` no claro; `0 6px 20px rgba(0,0,0,0.35)` no escuro). Em `prefers-reduced-transparency` ou hardware restrito, usar fundo 100% opaco.

---

## 5. Iconografia

Adotar um único conjunto de ícones vetoriais lineares com espessura uniforme (`stroke-width: 1.5` ou `1.75`, cantos consistentes). Recomendação: **`lucide-react`** (leve, tree-shakeable, licença ISC, amplo suporte para CAD/arquitetura/UI).

| Conceito | Ícone sugerido (`lucide`) | Disponível em |
|---|---|---|
| Abrir arquivo local | `FolderOpen` / `Upload` | v0.1 |
| Órbita | `Orbit` ou `Rotate3d` | v0.1 |
| Pan (Arrastar) | `Hand` ou `Move` | v0.1 |
| Enquadrar (Fit View) | `Maximize2` ou `Focus` | v0.1 |
| Resetar câmera | `RotateCcw` / `Home` | v0.1 |
| Grid / Eixos | `Grid3x3` / `Axis3d` | v0.1 |
| Tema Claro / Escuro | `Sun` / `Moon` | v0.1 |
| Árvore / Componentes | `Layers` / `Boxes` | v0.2 |
| Ocultar / Mostrar | `Eye` / `EyeOff` | v0.2 |
| Isolar | `Focus` / `Scan` | v0.2 |
| Vista Explodida | `Expand` / `Ungroup` | v0.4 |
| Montagem (Timeline) | `Play` / `Pause` / `SkipBack` | v0.5 |
| Corte (Clipping) | `Scissors` / `SquareSplitHorizontal` | v0.6 |
| Medição | `Ruler` | v0.6 |

Regra de clareza: em controles ambíguos (ex.: *Fit*, *Reset*, *Isolar*, *Explodir*), sempre fornecer `aria-label` completo e **tooltip no hover/foco** com nome da ação + atalho de teclado entre colchetes ou tag `kbd` (ex.: `Enquadrar modelo  F`). Em tablet/touch, manter rótulos curtos nos botões principais ou legenda clara no menu expandido.

---

## 6. Microinterações e movimento

- **Duração padrão:** `140ms` para estados de hover/seleção; `180ms` para abertura/fechamento de drawers; `220ms` para transições de bottom sheet.
- **Curva:** `cubic-bezier(0.2, 0, 0, 1)` (entrada firme, desaceleração limpa, sem bounce infantil).
- **Regra de não bloqueio:** animações de UI jamais devem bloquear cliques no canvas ou atrasar o disparo de comandos de câmera.
- **`prefers-reduced-motion: reduce`:** desativar transições de slide/fade de painéis e aplicar troca instantânea; no motor 3D, evitar interpolação longa de câmera em `Fit`/`Reset` quando o usuário solicitar movimento reduzido.

---

## 7. Acessibilidade e internacionalização (i18n)

### 7.1 Acessibilidade (WCAG 2.1 AA)

- **Foco visível obrigatório:** anel de foco `2px solid var(--gg-accent)` com `outline-offset: 2px` em `:focus-visible` (não exibir ao clicar com mouse).
- **Regiões vivas (`aria-live="polite"`):** anunciar carregamento concluído, quantidade de elementos selecionados e erros de importação/WebGL.
- **Navegação por teclado (Desktop):**
  - `Tab` / `Shift+Tab` percorre topbar, painéis e toolbar.
  - Árvore com padrão WAI-ARIA `role="tree"` / `role="treeitem"` (setas ↑/↓/←/→ em v0.2).
  - `Esc` limpa seleção ativa ou fecha modal/popover aberto.
  - Atalhos de viewport (apenas quando foco não estiver em `<input>`): `F` (Enquadrar), `R` (Resetar câmera), `1` (Painel esquerdo), `2` (Painel direito), `G` (Grid/Eixos), `T` (Alternar tema — opcional).

### 7.2 Centralização de textos para i18n

Conforme `AGENTS.md`, a interface nasce em **português (PT-BR)**, mas **nenhuma string visível ao usuário deve ficar dispersa em JSX**.
- Criar dicionário tipado centralizado (ex.: `geogenviewer/lib/i18n/pt-BR.ts`) agrupado por domínio (`common`, `home`, `topbar`, `viewport`, `importer`, `errors`, `tree`, `inspector`, `assembly`).
- Formatação de números e unidades via `Intl.NumberFormat('pt-BR', ...)` encapsulado em helper de unidades (`mm`, `cm`, `m`, `m²`, `m³`), mantendo ponto ou vírgula consistente com o padrão local e facilmente comutável para `en-US` no futuro.
