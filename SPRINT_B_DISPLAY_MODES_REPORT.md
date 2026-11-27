# GeoGenViewer — Sprint B (Modos Gráficos e Identidade)

**Branch local:** `feat/v0.9.12-sprint-a` · **Versão:** `0.9.12` · **Data:** 26/11/2026

## 1. Entregas implementadas

### 1.1 Mono 2.0 (`mono`)
- Superfícies foscas uniformes sem iluminação (`MeshBasicMaterial`, `unlit: true`, `#151515` padrão) com `polygonOffset` positivo para evitar *z-fighting*.
- Arestas construtivas de alto contraste (`#F5F5F5`) geradas por `EdgesGeometry` com limiar angular de `25°` (sem poluição de triangulação coplanar), oclusão natural de linhas ocultas pelo *depth buffer* e suporte a espessura configurável (`0.75`–`3.00 px`) via `LineSegments2` / `LineMaterial` sincronizado com viewport e resolução de captura PNG.
- Fundo claro editorial (`#FAFAF8`), inversão B/W opcional e personalização local de cor de superfície, arestas e fundo.

### 1.2 Blueprint + Tema Blueprint de Interface (`blueprint`)
- Ambiente técnico com fundo `#102E50`, superfícies `#234B70`, arestas `#BCDFFF`, seleção ciano `#54E6FF` (hover `#9BEEFF`) e grade técnica dedicada (`#4A89C4` / `#234E78`).
- Tema completo de interface (`data-graphics-theme="blueprint"` em `globals.css`) cobrindo painel lateral, topbar, menus, popovers/diálogos portais Base UI, ViewCube SVG, barra de ferramentas, indicadores e badges (`#0B1D30` / `#54E6FF`), com chave contextual para sincronizar/dessincronizar a UI mantendo a restauração integral do tema anterior ao sair do modo.

### 1.3 Dither (`dither`)
- Passe GLSL dedicado (`displayEffectFactories.dither` em `display-effects.ts`) operando estritamente sobre a cena 3D sem pixelizar a interface nem os overlays.
- Matriz ordenada Bayer `4×4` e `8×8` ancorada em coordenadas de tela (sem ruído temporal durante órbita/pan/zoom), paleta `#F3F1EB` / `#202020`, controles de intensidade, contraste, escala do padrão, arestas opcionais, inversão e cores personalizadas.
- Preservação integral do canal alfa (`alpha = 0` fora da geometria) para exportação PNG com fundo transparente em `1280`, `1920` e `3840 px`.

### 1.4 Clay (`clayStudio`)
- Aparência física de maquete (`#D9D4CB`, `roughness: 0.96`, `metalness: 0`), fundo de estúdio `#EEECE7`, plano de chão opcional `#E5E2DC` e rig de iluminação com hemisférica, key, fill e rim light.
- Oclusão ambiental sensível à escala do modelo via `GTAOPass` (`displayEffectFactories.studio`, calibrado por `setSceneScaleRadius` e compatível com câmera perspectiva e ortográfica) com controle contextual de intensidade de AO (`0%`–`150%`) e exposição (`25%`–`200%`), mais sombras PCF.
- Degradação graciosa para renderização convencional de estúdio nos presets `Desempenho`, viewports múltiplas ou compactas (`< 640 px`), clipping ativo e ausência de WebGL2.

### 1.5 Seletor `Exibição`, `Resumo`, `Knolling` e Exportação PNG
- Popover **Exibição** (`display-options.tsx`) com grade de presets visuais para **Mono**, **Blueprint**, **Dither** e **Clay**, seletor categorizado preservando todos os 12 modos existentes e cartões contextuais por modo com botão de restauração.
- **Resumo** (`model-summary.tsx`) reorganizado em blocos tabulares (`Identificação`, `Geometria`, `Fabricação`) com `tabular-nums`, badges de cobertura e adaptação responsiva (`375 px`, `900 px`, `1440 px`).
- **Knolling** (`documentation-overlay.tsx`, `callouts.ts`) com badges de título posicionados acima do limite superior de cada grupo no plano projetado, barra de acento e paleta adaptativa automática para `Blueprint`, `Mono`, claro e escuro.
- Correção do viewport offscreen na composição de efeitos durante `capturePng`, garantindo enquadramento integral em exportações de alta resolução (`1920 px`) para Dither e Clay (opaco e transparente).

## 2. Comparativo visual e telemetria (SwiftShader / Chrome `159.0.8154.33`)

Fixtures: `pavilhao-explosao` (18 componentes, carga `21 ms`) e `catalog-lab/rev-01` (15 componentes, carga `19 ms`).

| Modo | Draw calls | Triângulos | Geometrias | Materiais | Órbita (7 quadros, média ms) | PNG 1920 px (bytes) | Evidência (`geogenviewer/test-results/sprint-b/`) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Mono 2.0 | 47 | 1932 | 3 | 4 | 64,57 ms | 132.930 | `01-mono-desktop.png`, `01-mono-1920.png` |
| Blueprint | 48 | 1932 | 4 | 5 | 67,07 ms | 264.869 | `02-blueprint-desktop.png`, `02-blueprint-1920.png` |
| Dither | 25 | 277 | 3 | 8 | 76,21 ms | 125.430 (opaco) / 141.281 (transp.) | `03-dither-desktop.png`, `03-dither-transparent-1920.png` |
| Clay (Alta + GTAO + sombras + chão) | 98 | 1111 | 4 | 4 | 190,14 ms | 714.174 | `04-clay-desktop.png`, `04-clay-1920.png` |
| Clay (Desempenho, fallback) | 24 | 276 | 2 | 3 | — | — | `report.json` |

- **Descarte ao retornar ao modo `shaded` (`catalog-lab/rev-01`):** `22` draw calls, `252` triângulos, `16` geometrias, `3` materiais, sem vazamentos nem erros de página/console.
- **Acessibilidade (Axe WCAG 2.0/2.1 A/AA):** `0` violações em `Blueprint` (UI inteira) e `Resumo`.
- **Responsividade:** `1024×768` e `390×844` sem overflow e com popover `Exibição` integralmente dentro da viewport.

## 3. Verificações executadas

| Comando | Resultado |
| --- | --- |
| `npm --prefix geogenviewer run lint` | Passou (`0` erros) |
| `npm --prefix geogenviewer run typecheck` | Passou (`0` erros) |
| `npm --prefix geogenviewer test` | Passou (`79/79` testes unitários) |
| `npm --prefix geogenviewer run build` | Passou (`8/8` rotas estáticas) |
| `node geogenviewer/scripts/verify-sprint-b.mjs` | Passou (`0` erros, `0` violações Axe) |
| `npm --prefix geogenviewer run test:v0912` | Passou |
| `npm --prefix geogenviewer run test:ui` | Passou |
| `npm --prefix geogenviewer run test:v05` a `test:v091` | Todos passaram (`0` falhas) |

## 4. Limitações conhecidas

1. As medições desta entrega foram obtidas em Windows com **ANGLE/Vulkan SwiftShader** (rasterização em software); tempos absolutos de GTAO (`190,14 ms`/quadro em Alta com SwiftShader) e comportamento em hardware GPU dedicado/iPad ainda exigem medição em dispositivo físico.
2. Em modelos grandes (`evaluateLargeModel`), ou com múltiplas viewports / telas `< 640 px` / `clipping` ativo, `Clay` desativa o passe GTAO e usa apenas a iluminação e sombras convencionais do perfil de estúdio para preservar responsividade.
3. Sombras de contato em `Clay` combinam `GTAOPass` (em escala `0,5×` Equilibrada / `0,75×` Alta) com sombras PCF e plano receptor opcional; não há passe separado dedicado exclusivamente a *contact shadows* em *screen-space* quando GTAO está desligado.
4. `LineSegments2` de arestas espessas em `Mono`/`Blueprint` ignora agrupamento por `InstancedBatchManager` (ativa `originalPath`) para preservar arestas individuais e espessura configurável; em modelos com milhares de instâncias idênticas com arestas ligadas, recomenda-se desativar arestas ou usar o preset `Desempenho`.
5. Homologação externa pendente: modelo autorizado real da Casa Gerassi, execução real do `GeoGenExporter` no Rhino 8 e validação em tablet físico.
