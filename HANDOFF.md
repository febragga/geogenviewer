# GeoGenViewer — handoff entre agentes

**Última atualização:** 25/11/2026  
**Status:** Sprint 02.1 concluída — toolchain de design (`ui-ux-pro-max`, `@base-ui/react`, `lucide-react`, `react-resizable-panels`, `vaul`, `cmdk`, `playwright`, `@axe-core/playwright`) configurada, UI v0.1 refinada com identidade visual do portfólio e validada em Chromium isolado (desktop, tablet e smartphone) com 0 violações `axe-core`.  
**Responsável ativo sugerido:** Codex (v0.2: seleção individual, árvore interativa e visibilidade) após commit da base v0.1 pelo responsável.  
**Branch / commit:** `feat/viewer-bootstrap` (base `4546a26`; alterações das Sprints 02/02.1 no working tree).

## 1. Contexto e decisões

- Aplicação independente do portfólio, com hospedagem futura separada. O primeiro caso real é a maquete desmontável da Casa Gerassi. Apenas a fixture sintética acompanha o projeto.
- A raiz contém os documentos compartilhados com o Antigravity. A aplicação Next.js está em `geogenviewer/`. Ver `ARCHITECTURE.md` para as decisões do bootstrap.
- O fluxo corrente é GLB local. O manifesto versionado, o schema executável e o exportador Rhino continuam no escopo da v0.3.

## 2. Entregáveis disponíveis

| Item | Estado |
|---|---|
| Repositório GitHub | `origin` configurado e consultado. O remoto retornou sem refs |
| Fundação Next.js/TypeScript | Scaffold preservado, npm lockfile e scripts de verificação |
| `/viewer` | UI v0.1 refinada com DNA do portfólio, painéis redimensionáveis, paleta de comandos (`Ctrl+K`), bottom sheet `vaul`, `@base-ui/react` tooltips/menus e auditoria WCAG `axe-core` aprovada |
| `/` | Página inicial técnica com grade arquitetônica, seleção de tema e acesso direto a `/viewer` e `/viewer?demo=1` |
| `DESIGN_TOOLCHAIN.md` | Catálogo completo de skills, MCPs, bibliotecas frontend, rejeições e instruções para o Codex |
| Fixture | Estrutura sintética com oito elementos e cubo de 100 mm |
| CraftBot | Auditoria estática com SHA e amostra registrada |
| Tablet físico, Rhino, hospedagem e DNS | Validações ou decisões pendentes |

## 3. Tarefa ativa — próxima etapa para o Codex (v0.2)

O Antigravity encerrou a participação na Sprint 02.1 para evitar alterações concorrentes durante o desenvolvimento pelo Codex. A v0.1 está visualmente refinada, verificada e pronta para receber seleção, árvore interativa, visibilidade e propriedades nas próximas etapas.

### Pontos de integração UI ↔ Motor Gráfico para o Codex (`v0.2`–`v0.4`)

1. **Orquestração e estado compartilhado (`geogenviewer/src/features/viewer/viewer.tsx`):**
   - `Viewer` mantém hoje apenas estado local React (`loaded`, `mode`, `command`, `leftOverride`, `rightOverride`, `mobileTab`, `focusMode`, `helpOpen`, `commandOpen`).
   - Ao introduzir **Zustand** (`src/features/viewer/state/`) na v0.2, manter **fora do store** objetos `THREE.Object3D`, `BufferGeometry` e `Material` (armazenar apenas IDs selecionados/ocultos/isolados, resumo serializável `SceneSummary`, estado de carga e flags de modo), conforme `ARCHITECTURE.md` e `UI_ARCHITECTURE.md`.
   - O `Viewport` (`src/features/viewer/scene/viewport.tsx`) e o importador (`src/lib/geogen/importers/glb.ts`) permaneceram intactos na Sprint 02.1; o descarte (`loaded.model.dispose()`) continua sob responsabilidade do fluxo de troca/unmount em `viewer.tsx`.

2. **Painel esquerdo — Hierarquia, busca e visibilidade (`viewer-panels.tsx` → `StructureContent`):**
   - `StructureContent` já recebe `summary.rootNodes` (`SceneNodeSummary[]`: `key`, `name`, `elementId`, `hasMesh`) extraídos de `model.scene.children` (incluindo `userData.geogenElementId`) e exibe hoje como lista somente-leitura.
   - O campo `#gg-tree-search` (`input[type="search"]`) já está posicionado com `disabled`; na v0.2, conectá-lo ao filtro por `name` / `elementId` / camada e substituir os `<li>` estáticos por nós interativos WAI-ARIA (`role="tree"` / `role="treeitem"`) com ações de seleção, ocultar/mostrar e isolar/restaurar.
   - A seleção via raycasting no `Viewport` deve atualizar o mesmo `selectedElementIds` consumido por `StructureContent` (sincronização bidirecional 3D ↔ árvore).

3. **Painel direito — Inspetor de propriedades (`viewer-panels.tsx` → `PropertiesContent`):**
   - A seção superior (`Arquivo e cena atual`) já consome métricas reais (`fileSizeBytes`, `nodeCount`, `meshCount`, `boundsMeters` com nota explícita de AABB vs CAD).
   - A seção inferior (`Componente selecionado`, marcada `v0.2 · v0.4`) já possui os slots `<dl>` para `ID do elemento`, `Camada`, `Material` e `Dimensões CAD`, hoje exibindo `Indisponível na v0.1`. Na v0.2 preencher ao menos `ID` e `Nome` do nó selecionado; na v0.3/v0.4 conectar os dados do `manifest.json` com selo de proveniência (`CAD` / `Malha` / `Informado`).

4. **Toolbar e Paleta de Comandos (`viewer-toolbar.tsx` e `command-palette.tsx`):**
   - `ViewerToolbar` já reserva botões `disabled` com badges de marco para `Explodir (v0.4)`, `Corte (v0.6)` e `Medir (v0.6)` sem simular lógica falsa; habilitar progressivamente conforme cada marco for entregue.
   - Novos atalhos e comandos reais (ex.: `Isolar seleção`, `Mostrar tudo`, `Limpar seleção`) podem ser adicionados diretamente aos grupos existentes de `CommandPalette` (`command-palette.tsx`) e ao dicionário centralizado `copy.ts`.

5. **Validação automatizada preservada:**
   - Script `geogenviewer/scripts/verify-ui.mjs` (`npm --prefix geogenviewer run test:ui`) deve continuar sendo executado após mudanças de UI/cena para garantir 0 erros de console, 0 requisições externas, ausência de overflow e 0 violações `axe-core` em Light e Dark.

## 4. Pendências

| Pendência | Quando |
|---|---|
| Identidade Git e primeiro commit | Após configuração da autoria local pelo responsável |
| Toque em tablet físico | Quando houver o dispositivo de referência |
| Benchmark comparável do CraftBot e GeoGenViewer | Após definir cenas equivalentes e o dispositivo |
| Schema v1, GLB + manifesto e exportação Rhino 8 | v0.3 |
| Modelo, escala e sequência reais | Após autorização dos dados da IC |
| Hospedagem e DNS | Após autorização e validação de preview |

## 5. Registro de passagem (adicionar uma entrada a cada tarefa)

### 2026-11-25 — documentação inicial
- Agente: ChatGPT (planejamento).
- Branch/commit: não verificado.
- Alterações: seis Markdown de fundação; nenhum código de aplicação.
- Decisões: GLB + manifesto, aplicação independente, local-first, MVP pequeno.
- Verificação: coerência documental e exemplo sintético; software não executado.
- Limitações: workspace não acessado, não há teste real de Rhino/GLB/tablet, não há DNS aplicado.
- Próximo passo: inspecionar projeto e iniciar v0.0.

### 2026-11-25 — pesquisa de UX, design system e arquitetura de UI
- Data / agente: 2026-11-25 / Antigravity (Product Design & Frontend Engineering).
- Tarefa / status: Planejamento e especificação de UI/UX para GeoGenViewer / concluída.
- Branch / commit: `main` (sem commits ainda; `C:\Site-GeoGenViewer\.git` pertencente a `PC2/CodexSandboxOffline`).
- Arquivos modificados: criados `UX_RESEARCH.md`, `DESIGN_SYSTEM.md` e `UI_ARCHITECTURE.md`; atualizado `HANDOFF.md`. Nenhum arquivo de código em `geogenviewer/` foi alterado.
- Decisões e justificativa:
  - Manter `geogenviewer/` no estágio atual sem implementar UI prematura antes da base v0.0/v0.1 do Codex.
  - Adotar linguagem neutra com acento azul-claro/azul-acinzentado (`#256F96` claro / `#5BAAD4` escuro), suporte equivalente a Light/Dark, fontes `Geist` + `Geist_Mono` já presentes e alvos touch `>= 44×44 CSS px` com foco no tablet da Casa Gerassi.
  - Restringir v0.1 ao que funciona de verdade (Topbar enxuta, dropzone/seletor GLB local, viewport dominante, Toolbar básica e estados de progresso/erro/WebGL perdido), deixando Árvore (v0.2), Inspetor completo/Explode (v0.4) e Timeline (v0.5) sem simulação falsa.
  - Definir contrato desacoplado UI ↔ Scene (`ViewerUIState` sem objetos Three.js no Zustand + `SceneController` imperativo).
- Comandos executados e resultados:
  - `git -C C:\Site-GeoGenViewer status`: retornou `fatal: detected dubious ownership in repository at 'C:/Site-GeoGenViewer'` (`.git` pertence a `PC2/CodexSandboxOffline`, sessão atual `PC2/_`).
  - `git --git-dir=C:\Site-GeoGenViewer\.git --work-tree=C:\Site-GeoGenViewer status`: confirmou `On branch main`, `No commits yet`, arquivos da raiz e `geogenviewer/` não rastreados.
  - Inspeção de arquivos e `node -v` (`v22.14.0`), `npm -v` (`10.9.2`): identificado Next.js `16.4.6`, React `19.3.0`, Tailwind `4.3.3` (`@tailwindcss/turbopack`), `app/` sem `src/`, `next.config.ts` com `cacheComponents: true` e `partialPrefetching: true`, sem `three`/R3F/`zustand`/rotas `/viewer`.
- Testes manuais (dispositivo/viewport): não aplicável nesta etapa documental.
- Limitações / riscos / bloqueios:
  - Código-fonte do CraftBot não clonado localmente (análise baseada em `CRAFTBOT_ANALYSIS.md` e documentação pública).
  - Risco de incompatibilidade se `@react-three/fiber@8` for instalado com `react@19.3.0` (exige R3F v9+).
  - Ausência de `.gitignore` na raiz `C:\Site-GeoGenViewer` para modelos privados (`.3dm`, `.glb`) e aviso de `dubious ownership` no `.git` compartilhado entre ambientes.
- Mudanças que outro agente deve evitar sobrescrever: `UX_RESEARCH.md`, `DESIGN_SYSTEM.md`, `UI_ARCHITECTURE.md` e documentos fundacionais na raiz sem alinhamento.
- Próxima ação concreta: Codex concluir v0.0 e primeira fatia v0.1 (verificar `.gitignore` na raiz e commit inicial, adicionar scripts `typecheck`/`test`, validar R3F v9 + `next/dynamic(..., { ssr: false })`, criar fixture sintética com cubo `100 mm` e expor contrato `SceneController` / Zustand para Antigravity implementar a UI responsiva da v0.1).

### Modelo para próxima entrada

```text
Data / agente:
Tarefa / status (planejada, em andamento, bloqueada, concluída):
Branch / commit:
Arquivos modificados:
Decisões e justificativa:
Comandos executados e resultados (incluindo falhas):
Testes manuais (dispositivo/viewport):
Limitações / riscos / bloqueios:
Mudanças que outro agente deve evitar sobrescrever:
Próxima ação concreta:
```

Não colocar senhas, tokens, caminhos de arquivos privados desnecessários ou dados acadêmicos neste histórico. Handoff deve permanecer curto e factual; mover histórico antigo para arquivo separado se crescer excessivamente.

### 2026-11-25 — bootstrap V0.0 e primeira fatia V0.1

- **Agente e estado:** Codex. Fundação e visualizador básico implementados localmente no scaffold `geogenviewer/`. Os documentos do Antigravity na raiz foram preservados.
- **Git:** `origin` configurado como `https://github.com/febragga/geogenviewer.git`. A consulta de leitura ao remoto retornou sem refs. Branch local inicial `feat/viewer-bootstrap`, ainda sem commit por falta de `user.name` e `user.email` configurados. A conta Windows marcou apenas `C:/Site-GeoGenViewer` como `safe.directory` por diferença de propriedade do diretório `.git` criado no sandbox. Publicação, merge e deploy aguardam autorização específica.
- **Entrada e fronteiras:** `app/viewer/page.tsx` monta `src/features/viewer/viewer.tsx`, responsável pelo seletor, estados, troca de arquivo e ações. Textos em `src/features/viewer/copy.ts`. `scene/viewport.tsx` recebe `ImportedModel`, comando de câmera e modo de navegação. O importador em `src/lib/geogen/importers/glb.ts` valida o GLB e devolve `{ scene, bounds, dispose }`. Preservar a responsabilidade de descarte ao alterar a UI.
- **Demonstração:** `public/demos/estrutura.glb` é gerado por `npm run fixture`. Contém oito nós independentes, geometria compartilhada e cubo de 100 mm. O visualizador abre a demo pelo botão dentro de `/viewer`.
- **Verificação:** instalação limpa com `npm ci --no-fund`, seguida de `npm run lint`, `npm run test` (2 testes), `npm run build` e `npm run typecheck`. O Chrome headless com SwiftShader testou desktop em 1280×850 e tablet emulado em 820×1180. Verificados GLB local, órbita, zoom, pan por toque, teclado, enquadramento, reset, modelo inválido, troca de arquivo e recuperação após perda de WebGL. Na importação local o monitor de rede observou apenas GETs de recursos da aplicação. O teste unitário valida o descarte da geometria compartilhada.
- **Auditoria e limites:** CraftBot auditado estaticamente na revisão registrada em `CRAFTBOT_ANALYSIS.md`. Benchmark, tablet físico, ensaio com Rhino real e validação executável do manifesto estão pendentes. O importador básico aceita GLB 2.0 autocontido de até 100 MiB, com os codecs obrigatórios Draco, Meshopt e Basis adiados. A barra de estado indica leitura e preparação, em vez de porcentagem estimada. O npm emite aviso de fim de suporte do ESLint 9 do scaffold. O teste Node emite aviso de type stripping experimental. No Chrome headless, as dependências emitiram aviso de depreciação de THREE.Clock e aviso de WEBGL_lose_context em descarte de contexto. A recuperação da cena passou no smoke test.
- **Próxima ação para o Antigravity:** ler explicitamente `AGENTS.md` e os documentos compartilhados. Refinar a UI dentro do escopo v0.1, mantendo a API do viewport, a importação local e os testes. Repetir os fluxos em tablet físico quando disponível. Trabalhar serialmente ou em branch própria após existir uma base local registrada.

### 2026-11-25 — Sprint 02.1: upgrade de toolchain de design, refinamento visual e auditoria Playwright/axe-core
- Data / agente: 2026-11-25 / Antigravity (Product Design & Frontend Engineering).
- Tarefa / status: Sprint 02.1 — Design Toolchain Upgrade & Visual Refinement / concluída.
- Branch / commit: `feat/viewer-bootstrap` (base `4546a26`; fechamento da Sprint 02.1 em commit próprio na branch, sem merge em `main`).
- Arquivos modificados/criados:
  - Raiz: `.gitignore` (regras para `test-results/`, `playwright-report/`, `screenshots-*/`, `.superdesign/`, `__pycache__/`, `*.pyc`), `DESIGN_TOOLCHAIN.md`, `.agents/skills/` (`ui-ux-pro-max` e skills locais), `skills-lock.json`, `AGENTS.md`, `DESIGN_SYSTEM.md`, `UI_ARCHITECTURE.md` e `HANDOFF.md`.
  - `geogenviewer/package.json` + `package-lock.json`: adicionados `lucide-react@1.80.0`, `@base-ui/react@1.9.0`, `react-resizable-panels@4.24.3`, `vaul@1.1.2`, `cmdk@1.1.1` e devDependencies `playwright@1.65.1`, `@axe-core/playwright@4.14.1`; adicionado script `test:ui`.
  - `geogenviewer/scripts/verify-ui.mjs` e `geogenviewer/.gitignore`: preservado script automatizado Playwright + `@axe-core/playwright` com saída de screenshots em `test-results/` (ignorado pelo Git).
  - `geogenviewer/app/globals.css`, `app/layout.tsx`, `app/page.tsx`: tokens alinhados à identidade editorial de `febragga/portfolio` (`#0C0D0E`/`#17191A`/`#202223`/`#343637`/`#B5DAF2` em Dark; `#EDF0F3`/`#F8F9FB`/`#1D5F82` em Light), marcadores `.gg-section-index`, separadores de resize, estilos de tooltip/menu/cmdk/vaul, `.gg-axes` no canto superior direito e contraste WCAG AA.
  - `geogenviewer/src/features/viewer/`: atualizados `copy.ts`, `viewer.tsx` e `components/` (`icons.tsx`, `theme-toggle.tsx`, `ui-tooltip.tsx`, `command-palette.tsx`, `viewer-topbar.tsx`, `viewer-toolbar.tsx`, `viewer-panels.tsx`).
- Decisões e justificativa:
  - Escolhido `@base-ui/react` + `vaul` + `cmdk` em paridade direta com `febragga/portfolio`, rejeitando Radix UI (evita duplicidade), shadcn MCP, 21st.dev Magic MCP, Figma MCP e Motion (transições CSS nativas suficientes).
  - `superdesign` mantido sem login/token para evitar envio de arquivos a serviço externo sem autorização.
  - Script `scripts/verify-ui.mjs` preservado no projeto com Playwright isolado (`channel: "chrome"` + SwiftShader WebGL) e `axe-core` para regressão visual contínua nas próximas versões.
- Comandos executados e resultados:
  - `npm --prefix geogenviewer run lint`: aprovado (0 erros).
  - `npm --prefix geogenviewer run typecheck`: aprovado (0 erros).
  - `npm --prefix geogenviewer run test`: aprovado (2/2 testes em `tests/glb.test.mjs`).
  - `npm --prefix geogenviewer run build`: aprovado (`next build`, rotas estáticas `/` e `/viewer`).
  - `npm --prefix geogenviewer run test:ui`: aprovado (`scrollWidth === innerWidth` em `1440×900` e `390×844`, `toolbarAxesOverlap: false`, `consoleErrors: []`, `pageErrors: []`, `failedRequests: []`, `externalRequests: []`, `axeViolations` zerado em `home`, `viewerDark` e `viewerLight`).
- Testes manuais (dispositivo/viewport): capturas comparativas *antes* e *depois* verificadas em `1440×900` (Dark/Light, empty, loaded, `Ctrl+K`), `1024×768` (tablet horizontal), `768×1024` (tablet vertical + drawer) e `390×844` (smartphone + Vaul sheet). Validação em tablet físico segue pendente.
- Limitações / riscos / bloqueios:
  - Superdesign CLI sem autenticação (`superdesign auth status` -> `not authenticated`).
  - Validação em dispositivo tablet físico pendente.
- Mudanças que outro agente deve evitar sobrescrever: `DESIGN_TOOLCHAIN.md`, tokens de `geogenviewer/app/globals.css`, script `geogenviewer/scripts/verify-ui.mjs` e primitivos `@base-ui/react` / `react-resizable-panels` / `vaul` / `cmdk` em `geogenviewer/src/features/viewer/`.
- Próxima ação concreta: Codex inicia `v0.2` sobre `feat/viewer-bootstrap` (seleção individual por clique/toque, Zustand sem objetos Three.js, árvore interativa em `StructureContent` e feedback inicial em `PropertiesContent`).
