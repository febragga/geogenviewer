# GeoGenViewer — arquitetura de interface (UI)

**Revisão:** 0.1 · 25/11/2026  
**Responsável:** Antigravity (Product Design & Frontend Engineering)  
**Alinhamento:** [ARCHITECTURE.md](file:///C:/Site-GeoGenViewer/ARCHITECTURE.md) · [ROADMAP.md](file:///C:/Site-GeoGenViewer/ROADMAP.md) · [DATA_SCHEMA.md](file:///C:/Site-GeoGenViewer/DATA_SCHEMA.md)

---

## 1. Arquitetura de informação e rotas

O GeoGenViewer utiliza Next.js App Router com separação estrita entre páginas institucionais/de entrada (renderizadas normalmente) e o ambiente WebGL (`'use client'` + `next/dynamic(..., { ssr: false })`).

| Rota | Propósito | Renderização | Marco no Roadmap |
|---|---|---|---|
| `/` | Apresentação objetiva da ferramenta: propósito, privacidade *local-first*, formatos aceitos (`GLB` + `manifest.json`) e acesso rápido a `/viewer` (e `/demo` quando disponível). | Server Component padrão | v0.1 (enxuta) |
| `/viewer` | Workspace 3D principal para abrir arquivos locais (`GLB` sozinho ou `GLB + manifest.json`). Nenhum byte sai do navegador. | Shell SSR leve + Viewport Client-only (`ssr: false`) | **v0.1 (prioridade imediata)** |
| `/demo` | Mesma arquitetura do `/viewer` pré-carregada com uma fixture sintética pública de `public/demos/` (ex.: cubo `100 mm` + estrutura simples, **nunca** dados da Casa Gerassi). | Client-only para cena | v0.1/v0.2 (conforme fixture pronta) |

> **Regra de escopo:** não modificar o portfólio principal do autor e não expor rotas de projeto por slug antes de existir mecanismo de publicação aprovado.

---

## 2. Organização do Workspace e evolução por marcos

O workspace completo prevê seis zonas funcionais. Para evitar **simulação de funções inexistentes**, cada zona entra em produção estritamente no marco correspondente do [ROADMAP.md](file:///C:/Site-GeoGenViewer/ROADMAP.md).

### 2.1 Matriz das 6 zonas por marco

| Zona | O que entra na **v0.1** (fundação funcional) | Evolução planejada (**v0.2 → v0.6+**) |
|---|---|---|
| **1. Topbar** (`44–48px`) | Identidade `GeoGenViewer`, nome do arquivo carregado (ou "Nenhum modelo carregado"), badge discreto `Modo Básico GLB` quando carregado, botão **Abrir GLB** (seletor local), alternador de **Tema (Claro/Escuro)** e botão de **Ajuda rápida** (controles de mouse/toque). | v0.3: `project.title` + `revisionId` + seletor duplo `GLB + Manifesto` + status de validação.<br>Futuro: configurações avançadas e compartilhamento autorizado. |
| **2. Painel Esquerdo** (`260–340px` desktop) | **Omitido ou recolhido na v0.1** para não exibir árvore falsa sem seleção real (opcionalmente um indicador mínimo de estado de carga/metadados do arquivo GLB no empty state/barra, se houver). | v0.2: **Árvore hierárquica**, abas/filtros por **Camadas** e **Grupos**, campo de **Pesquisa**, ações de **Visibilidade** (olho), **Isolamento** e seleção sincronizada (individual/múltipla). |
| **3. Viewport Central** (`flex-1`, dominante) | Canvas WebGL R3F, **Empty State** com zona de arrastar/soltar (drag-and-drop) e seletor de arquivo local, **barra de progresso** / cancelamento, banner ou estado explícito de **erro de arquivo** / **WebGL indisponível**, **eixos de referência** (XYZ) e grade opcional, **cubo/escala de referência**. | v0.2: highlight de seleção e hover.<br>v0.3+: cubo de orientação interativo (ViewCube / Gizmo).<br>v0.4: vista explodida.<br>v0.6: modos sólido/monocromático/wireframe e planos de corte. |
| **4. Painel Direito** (`280–360px` desktop) | **Omitido na v0.1** (sem simulação de propriedades inexistentes). | v0.2: resumo mínimo do nó selecionado (ID, nome).<br>v0.4: **Inspetor completo** — ID, `sourceObjectId`, categoria, camada, material, **dimensões orientadas** com selo obrigatório de origem (`CAD` / `Malha` / `Informado`), escala da maquete (`1:N`) e metadados `properties` renderizados estritamente como texto. |
| **5. Toolbar Flutuante** (inferior central) | Apenas controles reais da v0.1: **Órbita**, **Pan** (alternância explícita para touch/1-dedo/acessibilidade), **Enquadrar (Fit View)**, **Resetar Câmera** e **Alternar Grade/Eixos**. | v0.2: Selecionar / Isolar / Mostrar todos.<br>v0.4: Controle **Vista Explodida** (slider `0–1` com aviso quando heurístico).<br>v0.6: **Corte**, **Medição** e **Estilo visual**. |
| **6. Timeline Inferior** | **Omitida na v0.1–v0.4** (não exibir timeline vazia nem botões falsos de Play). | v0.5: Barra acoplada inferior com **etapas construtivas** (`assembly.steps`), Play/Pause, scrubber temporal, passo anterior/próximo e bloqueio explícito com mensagem informativa se o manifesto não definir sequência (e exclusividade mútua com Vista Explodida). |

---

## 3. Layouts responsivos (Desktop, Tablet e Smartphone)

### 3.1 Breakpoints e modos de interação

- **Desktop (`>= 1024px`, `pointer: fine`):** layout multi-painel ancorado; interação prioritária por mouse + teclado.
- **Tablet (`768px – 1023px` e dispositivos `pointer: coarse` até `1280px`):** prioridade absoluta para apresentações da Casa Gerassi. Painéis funcionam como drawers retráteis sem comprimir o viewport abaixo de `60%`.
- **Smartphone (`< 768px`):** viewport em tela cheia (`100dvh`); um único painel por vez em *Bottom Sheet*.

### 3.2 Desktop (`>= 1024px`)

```text
+-------------------------------------------------------------------------+
| [GG] GeoGenViewer | Estrutura demonstrativa (proto-01) | [Abrir] [Tema] |  44px
+----------------+---------------------------------------+----------------+
| Árvore (v0.2+) |                                       | Inspetor       |
| [Buscar...]    |                                       | (v0.2/v0.4+)   |
| - Pilares      |             VIEWPORT 3D               | ID / Nome      |
| - Vigas        |         (>= 70% da largura)           | Dimensões      |
|                |                                       | Material       |
|                |        [ Toolbar Flutuante ]          |                |
+----------------+---------------------------------------+----------------+
| Timeline de Montagem (v0.5+ — exibida apenas quando houver steps)       |  56px
+-------------------------------------------------------------------------+
```

- **Na v0.1 (sem painéis v0.2+):** o Viewport ocupa **100% abaixo da Topbar (`100vh - 44px`)**, com a Toolbar flutuante ancorada na base (`bottom: 16px`) e um cartão discreto de **Diagnóstico / Informações do GLB** retrátil apenas se necessário (ex.: contagem de malhas, triângulos, caixa envolvente de referência ou aviso de erro).
- **Redimensionamento (v0.2+):** divisórias arrastáveis de `4px` (área hit de `8px`) entre painéis e viewport, com limites `min: 240px / max: 400px` e botão de colapso rápido.

### 3.3 Tablet (`768px – 1023px` — foco Casa Gerassi)

```text
Paisagem / Retrato (Viewport 100% base; drawers sobrepostos):
+---------------------------------------------------------------+
| [GG] GeoGenViewer | Casa_Test (1:50) | [Abrir] [Apres.] [Tema]|  48px
+---------------------------------------------------------------+
| [≡ Estrutura]*                                 [ⓘ Props]*    |
|                                                               |
|                      VIEWPORT 3D (100%)                       |
|                   (Alvos touch >= 44x44px)                    |
|                                                               |
|            [ Órbita | Pan | Enquadrar | Reset | Grid ]        |
+---------------------------------------------------------------+
* Botões de painel aparecem somente a partir da v0.2.
```

Regras específicas para Tablet:
1. **Regra do painel único em retrato (`< 900px`):** abrir o Painel Esquerdo fecha automaticamente o Painel Direito (e vice-versa), garantindo que o modelo permaneça visível e manipulável.
2. **Alvos de toque:** todos os botões da Topbar, Toolbar e listas possuem altura/largura mínima de **`44×44 CSS px`** e espaçamento mínimo de `4–8px`.
3. **Modo Apresentação:** botão visível na Topbar que oculta Topbar estendida e painéis abertos, deixando o canvas em tela limpa com apenas um botão flutuante discreto no canto superior direito (`Sair da apresentação`) e, nas versões v0.4+, o slider compacto de Explode/Montagem.
4. **Orientação e Safe Area:** usar `h-dvh` (`100dvh`) em vez de `100vh` e respeitar `env(safe-area-inset-*)` para iPadOS/Safari.

### 3.4 Smartphone (`< 768px`)

```text
+-----------------------------------+
| [GG] GeoGenViewer   [Abrir] [⋯]   |  48px
+-----------------------------------+
|                                   |
|                                   |
|         VIEWPORT 3D (100%)        |
|        (1 dedo: orbita)           |
|        (2 dedos: pan/zoom)        |
|                                   |
|   [Fit] [Reset] [Órbita/Pan] [≡]  |  Toolbar compacta (44px)
+-----------------------------------+
| ====  Bottom Sheet (v0.2+)  ====  |  Estágios: fechado / 35% / 75%
+-----------------------------------+
```

Regras específicas para Smartphone:
1. **Um painel por vez:** Árvore e Propriedades são abas dentro de um único **Bottom Sheet** (a partir da v0.2).
2. **Prevenção de conflito de gestos:** o `<canvas>` bloqueia gestos do browser com `touch-action: none`; o Bottom Sheet só arrasta pela sua alça superior (`44px` de altura) ou fecha por botão explícito, mantendo scroll nativo interno no conteúdo da lista.
3. **Toolbar enxuta:** no máximo 4–5 ações primárias visíveis (`44×44px`), movendo ações secundárias (ex.: alternar tema, eixos, ajuda) para o menu `⋯`.

---

## 4. Especificação dos componentes da v0.1

Os componentes de interface da v0.1 devem ser organizados em `geogenviewer/features/viewer/components/` (ver nota de estrutura na Seção 6), mantendo regras de negócio e Three.js totalmente fora dos componentes visuais.

| Componente | Responsabilidade | Estados obrigatórios |
|---|---|---|
| `ViewerShell` | Orquestra layout responsivo (`h-dvh`, Topbar + área principal do Viewport), registra atalhos globais (`F`, `R`, `G`) fora de inputs e gerencia `drag-and-drop` global de arquivo `.glb`. | `idle`, `dragging-file`, `loading`, `ready`, `error` |
| `ViewerTopbar` | Marca GeoGenViewer, título do arquivo atual, badge de modo (`Básico GLB`), botão `Abrir GLB` (input oculto `.glb`), toggle de tema (`Claro`/`Escuro`) e botão de ajuda rápida. | Sem arquivo, arquivo carregado, carregando (botão abrir substitui carga atual com cancelamento seguro) |
| `ViewportEmptyState` | Exibido sobre o viewport quando `status === 'idle'`. Dropzone clara, botão grande `Selecionar arquivo GLB`, aviso explícito de privacidade ("Processamento 100% local no navegador; nenhum dado é enviado") e instruções de formatos suportados na v0.1. | Padrão, `drag-over` (borda azul-clara destacada) |
| `ViewportStatusOverlay` | Barra discreta de carregamento (`status === 'loading'`), botão `Cancelar` e painel de erro acionável (`status === 'error'` ou `webgl-lost`) com botão `Tentar outro arquivo` ou `Recarregar contexto`. | `loading` (indeterminado ou %), `error` (mensagem legível + caminho/causa), `webgl-lost` |
| `ViewportToolbar` | Barra flutuante inferior com alternância de modo de ponteiro (`Órbita` / `Pan`), `Enquadrar (F)`, `Resetar vista (R)` e `Grade/Eixos (G)`. | Ativo/inativo, desabilitado quando nenhum modelo estiver carregado (exceto Grade se visível no vazio) |
| `OrientationBadge` / `ScaleReferenceHint` | Indicador discreto no canto do viewport informando eixos (`Y↑` espaço glTF), unidade da cena (`m` / `mm` de exibição quando conhecido) e presença da grade/cubo de referência. | Visível com modelo carregado |
| `ControlsHelpPopover` | Popover/modal acessível explicando gestos de mouse e toque (1 dedo / 2 dedos) e atalhos de teclado da v0.1. | Aberto / fechado (`Esc` fecha) |

---

## 5. Contrato entre Frontend (UI) e Motor Gráfico (Scene / Estado)

Seguindo [ARCHITECTURE.md](file:///C:/Site-GeoGenViewer/ARCHITECTURE.md), a UI **nunca** armazena instâncias `THREE.Object3D`, `BufferGeometry` ou `Material` no estado Zustand, e **nunca** executa raycasting ou manipulação de cena diretamente dentro de componentes React de interface.

### 5.1 Fatia de estado compartilhado (Zustand — v0.1 e extensão prevista)

```ts
// Contrato conceitual a ser implementado pelo Codex em features/viewer/state/
export type ViewerLoadStatus =
  | 'idle'
  | 'validating'
  | 'loading'
  | 'ready'
  | 'error'
  | 'webgl-lost';

export type NavigationTool = 'orbit' | 'pan';

export interface LoadedModelSummary {
  fileName: string;
  fileSizeBytes: number;
  mode: 'glb-basic' | 'manifest-full'; // v0.1 usa apenas 'glb-basic'
  meshCount: number;
  nodeCount: number;
  triangleCountApprox?: number;
  boundingBoxMeters: [number, number, number]; // AABB apenas para referência de enquadramento, nunca medida CAD
}

export interface ViewerUIState {
  // Ciclo de carga (v0.1)
  status: ViewerLoadStatus;
  loadProgress: number | null; // 0..100 ou null quando indeterminado
  error: { code: string; message: string; actionHint?: string } | null;
  modelSummary: LoadedModelSummary | null;

  // Preferências visuais e navegação (v0.1)
  theme: 'light' | 'dark';
  activeTool: NavigationTool;
  showGrid: boolean;
  showAxes: boolean;
  presentationMode: boolean;

  // Extensões planejadas (não ativar na v0.1)
  // selectedElementIds: string[];       // v0.2
  // hiddenElementIds: Set<string>;      // v0.2
  // isolatedElementIds: string[] | null;// v0.2
  // explodeFactor: number;              // v0.4 (0..1)
  // assemblyStepIndex: number | null;   // v0.5
}
```

### 5.2 Interface imperativa do controlador de cena (`SceneController`)

Ações pontuais de câmera e ciclo de vida devem ser invocadas via callback/ref ou barramento fino entre a UI e o módulo de cena:

| Método / Ação | Disparado por (UI) | Efeito esperado no Motor Gráfico |
|---|---|---|
| `loadLocalGlb(file: File)` | `ViewerTopbar` / `ViewportEmptyState` / Drop | Valida extensão/tamanho/magic bytes; cancela carga anterior; cria ObjectURL; carrega via `GLTFLoader`; libera recursos da cena anterior (`dispose`) e revoga ObjectURL ao concluir ou falhar; atualiza `modelSummary` e executa `fitView()`. |
| `cancelLoad()` | `ViewportStatusOverlay` | Aborta carregamento ativo sem deixar cena parcial ou listeners pendentes. |
| `fitView()` | `ViewportToolbar` / tecla `F` | Enquadra a caixa envolvente do modelo visível (ou da seleção na v0.2+) preservando proporção e sem alterar escala da cena. |
| `resetCamera()` | `ViewportToolbar` / tecla `R` | Restaura posição/alvo iniciais calculados no carregamento do modelo atual. |
| `setNavigationTool('orbit' \| 'pan')` | `ViewportToolbar` | Ajusta mapeamento do ponteiro primário (mouse esquerdo / 1 dedo) no `OrbitControls` para facilitar uso em touch/trackpad. |
| `setViewportOptions({ showGrid, showAxes })` | `ViewportToolbar` / tecla `G` | Alterna visibilidade de grade e eixos auxiliares com invalidação sob demanda (`frameloop="demand"`). |

### 5.3 Eventos do Motor Gráfico → UI

1. `onWebGLContextLost()` → move estado para `'webgl-lost'` com mensagem clara ao usuário.
2. `onSceneStatsReady(summary)` → popula `modelSummary` para exibição discreta e correta em `ViewerTopbar` / diagnósticos.
3. *(v0.2+)* `onPointerSelect(elementId | null, isMulti)` → sincroniza seleção com árvore e inspetor sem duplicar objetos Three.js.

---

## 6. Achados técnicos do repositório e recomendações para o Codex

A inspeção real de `c:\Site-GeoGenViewer` revelou pontos importantes que exigem alinhamento antes do início da codificação:

### 6.1 Estrutura de diretórios atual vs `ARCHITECTURE.md`

- **Observado:** o projeto Next.js foi inicializado em `c:\Site-GeoGenViewer\geogenviewer\` usando a convenção **sem `src/`**: `geogenviewer/app/`, `geogenviewer/public/`, e `tsconfig.json` configura `"@/*": ["./*"]`.
- **Diferença:** `ARCHITECTURE.md` (seção 4) esboçava `src/app/`, `src/features/` e `src/lib/`.
- **Recomendação ao Codex:** manter a raiz sem `src/` (`geogenviewer/app/`, `geogenviewer/features/viewer/`, `geogenviewer/lib/geogen/`) para não brigar com o bootstrap existente e atualizar a árvore documental em `ARCHITECTURE.md` quando a v0.0 for consolidada.

### 6.2 Compatibilidade crítica: React `19.3.0` + Next.js `16.4.6` vs React Three Fiber

- **Observado:** [package.json](file:///C:/Site-GeoGenViewer/geogenviewer/package.json) declara `"next": "16.4.6"`, `"react": "19.3.0"` e `"react-dom": "19.3.0"`.
- **Risco técnico:** `@react-three/fiber@8` é incompatível com React 19 (quebra o reconciler interno). Para React 19, é necessário utilizar **`@react-three/fiber@^9`** e verificar versão compatível de `@react-three/drei` e `three`/`@types/three` (além de `zustand` v5 compatível com React 19).
- **Risco Next.js 16:** [next.config.ts](file:///C:/Site-GeoGenViewer/geogenviewer/next.config.ts) possui `experimental.agentFeedback: true`, `cacheComponents: true` e `partialPrefetching: true` habilitados por padrão do template, e [geogenviewer/AGENTS.md](file:///C:/Site-GeoGenViewer/geogenviewer/AGENTS.md) alerta explicitamente para consultar `node_modules/next/dist/docs/`. O viewport deve ser isolado via `next/dynamic(..., { ssr: false })` dentro de wrapper client-side adequado.

### 6.3 Estado do repositório Git e `.gitignore` na raiz

- **Observado:** existe um repositório Git inicializado na raiz `c:\Site-GeoGenViewer\.git` (branch `main`, `No commits yet`), pertencente ao usuário `PC2/CodexSandboxOffline` — ao executar `git -C C:\Site-GeoGenViewer status` como `PC2/_`, o Git reporta `detected dubious ownership` (enquanto `git --git-dir=C:\Site-GeoGenViewer\.git --work-tree=C:\Site-GeoGenViewer status` mostra todos os arquivos e `geogenviewer/` como *untracked*).
- **Risco:** há `.gitignore` dentro de `geogenviewer/`, mas ainda não foi verificado/adicionado um `.gitignore` na raiz `c:\Site-GeoGenViewer\` cobrindo modelos privados da IC (`.3dm`, `.glb`, etc.) e regras de pasta raiz antes do primeiro commit, além da configuração de Root Directory (`geogenviewer`) quando houver deploy na Vercel.
- **Recomendação ao Codex / Responsável:** alinhar a propriedade/`safe.directory` do repositório Git raiz, garantir `.gitignore` adequado na raiz conforme `ROADMAP.md` (v0.0) e realizar o commit inicial antes de criar branches de trabalho (`feat/...`).

### 6.4 Scripts ausentes no `package.json`

- **Observado:** `geogenviewer/package.json` possui apenas `dev`, `build`, `start` e `lint`. Ainda não existem `typecheck` (`tsc --noEmit`), `test` (Vitest) ou `test:e2e` (Playwright), exigidos em `ROADMAP.md` (v0.0) e `AGENTS.md`.
- **Recomendação ao Codex:** incluir `typecheck` e configuração de Vitest/Playwright já na v0.0.

### 6.5 Sugestões futuras para `DATA_SCHEMA.md` (sem alterar v1.0 agora)

Para não alterar unilateralmente `DATA_SCHEMA.md`, ficam registradas para avaliação conjunta em revisão futura (`v1.1` ou extensão):
1. Campo opcional `colorHex` em `layers` / `materials` para colorização consistente na árvore e modos diagramáticos.
2. Presets opcionais de câmera (`savedViews`: nome, posição, alvo) úteis para demonstração guiada da Casa Gerassi em tablet.
3. Suporte a `i18n` opcional em rótulos autorados (`title` / `description`) caso o projeto seja apresentado em inglês no futuro.
