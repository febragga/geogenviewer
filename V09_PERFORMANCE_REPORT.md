# GeoGenViewer V0.9 — Relatório de Desempenho (Antes vs Depois)

**Versão:** v0.9.0 · **Ambiente medido:** Node `v22.14.0` (`win32 x64`) + Chrome via Playwright (`ANGLE SwiftShader`)

---

## 1. Gargalos Diagnosticados e Otimizações Aplicadas

1. **Draw calls 1:1 no renderer WebGL (`InstancedBatchManager`, `src/features/viewer/scene/instancing.ts` + `display.ts` + `viewport.tsx` + `comparison-scene.tsx`):**
   - Malhas estáticas de material único com geometria/material compartilhados passam a ser agrupadas automaticamente em `InstancedMesh` a partir de `DEFAULT_MIN_BATCH_SIZE = 24`.
   - Modelos menores (como o pavilhão de 18 peças em `verify-v06`) mantêm exatamente seus `24` (vista única) e `96` (quad) draw calls; seleção individual, hover, transparência de montagem, clipping (`inspection-scene.ts`), picking por `hit.instanceId` e `Cor por camada` continuam funcionais.
2. **Cache de matriz pai no Knolling (`src/lib/geogen/documentation/knolling-pose.ts`):**
   - `parentInverses` em cache por `Object3D` pai evita recomputações repetidas de `updateWorldMatrix()` e `.invert()` para irmãos compartilhados, e reuso de mapa de posicionamento evita chamadas redundantes a `reset()`.
3. **Cache de busca e callouts (`catalog.ts`, `callouts.ts`, `documentation-overlay.tsx`):**
   - Cache `WeakMap` em `projectSearch()` para strings normalizadas NFD de itens do catálogo.
   - Cache `WeakMap` de âncoras locais em `makeCallout()`, teto de inspeção `limit * 8` (`640`) em `projectCallouts()`, cache de largura de texto `measureCachedText` e assinatura de câmera/viewport no `DocumentationOverlay` para evitar redesenho ocioso e leituras repetidas de `getComputedStyle`.
4. **Modo automático para modelos grandes (`settings-store.ts`):**
   - Avaliação automática por contagem de triângulos (`>= 120.000`) ou ocorrências (`>= 1.500`), ajustando qualidade para `performance` sem bloquear trabalho em modelos menores.

---

## 2. Comparativo GPU (`test:v08`, `GEOGEN_V08_GPU=1`)

| Métrica (`Chrome + SwiftShader`) | V0.8 Baseline (100 pçs) | **V0.9 (100 pçs)** | V0.8 Baseline (1.000 pçs) | **V0.9 (1.000 pçs)** | V0.8 Baseline (10.000 pçs) | **V0.9 (10.000 pçs)** |
|---|---|---|---|---|---|---|
| **Draw calls (cena principal)** | `101` | **`2`** (-98,0%) | `1001` | **`2`** (-99,8%) | `10001` | **`2`** (-99,98%) |
| **Draw calls (overlay callouts)** | `101` | **`2`** (-98,0%) | `1001` | **`2`** (-99,8%) | `10001` | **`2`** (-99,98%) |
| **FPS em atividade** | `39` | `30` | `42` | **`46`** | `32` | **`34`** |
| **Primeira miniatura (`firstThumbnailMs`)** | `260` ms *(ref. 10k: 264 ms)* | `312` ms | — | `256` ms | `264` ms | **`134` ms** |
| **Filtro no catálogo (`filterMs`)** | — | `121` ms | — | `82` ms | `387` ms | **`210` ms** |
| **Captura PNG (`captureMs`)** | — | `370` ms | — | `265` ms | `297` ms | `359` ms |

- **Lab (`verify-v08` 15 componentes):** `22` draw calls mantidos, `36 FPS` em atividade, carga `31 ms`, cache de miniaturas preservado (`before: 2, sameStyle: 2, technical: 3`).
- **Pavilhão (`verify-v06` 18 componentes):** `24` draw calls (single) e `96` (quad), preservando integralmente o contrato visual sem regressão.

---

## 3. Comparativo CPU (`benchmark:v07` e `benchmark:v08`)

| Operação (`Node v22.14.0`) | V0.8 Baseline (1.000 pçs) | **V0.9 (1.000 pçs)** | V0.8 Baseline (10.000 pçs) | **V0.9 (10.000 pçs)** |
|---|---|---|---|---|
| `benchmark:v08` — `sixPoseUpdatesMs` | `12,890` ms | **`9,715` ms** | `63,712` ms | **`50,819` ms** |
| `benchmark:v08` — `sheetDataMs` | — | `0,602` ms | `7,514` ms | **`6,898` ms** |
| `benchmark:v08` — `usedGeometries / disposedGeometries` | `1 / 1` | **`1 / 1`** | `1 / 1` | **`1 / 1`** |
| `benchmark:v07` — `loadBothMs` | `82,400` ms | **`76,981` ms** | `559,913` ms | `573,798` ms |
| `benchmark:v07` — `processHeapDeltaMiB` | `28,538` MiB | **`22,167` MiB** | `176,618` MiB | `179,478` MiB |

*(Obs.: A medição gráfica em Chrome headless via SwiftShader reflete rasterização por software; em hardware GPU dedicado e tablet físico o desempenho pode divergir e segue pendente de medição em dispositivo real).*
