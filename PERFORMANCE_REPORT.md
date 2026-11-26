# PERFORMANCE_REPORT.md — Métricas de Escala Sintética (V0.2 e V0.3)

**Data:** 25/11/2026  
**Script reproduzível:** `node --experimental-strip-types geogenviewer/scripts/benchmark-scenes.mjs`  
**Escopo:** Medição de importação GLB básico, validação Ajv + semântica JSON v1.0, indexação `ViewerSceneGraph`, achatamento/busca da árvore de componentes e resolução `Object3D -> componentId` em cenas sintéticas controladas de 100, 1.000 e 10.000 componentes.

## 1. Resultados Medidos

| Componentes | GLB (bytes) | Manifesto (bytes) | Validação JSON (ms) | Import Básico (ms) | Import Completo + SHA-256 (ms) | Achatar Árvore (ms) | Busca na Árvore (ms) | Resolução de 100% IDs (ms) | Δ Heap Node (MB) |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 11.240 | 20.997 | 7,63 | 9,26 | 6,33 | 0,44 | 0,21 | 0,03 | 4,56 |
| 1.000 | 114.720 | 201.600 | 5,79 | 24,03 | 25,09 | 0,48 | 0,48 | 0,13 | 8,01 |
| 10.000 | 1.162.920 | 2.016.603 | 34,68 | 165,59 | 170,43 | 4,50 | 6,09 | 0,68 | 112,91 |

## 2. Otimizações Estruturais Implementadas

1. **Resolução `Object3D -> componentId` O(1)/O(profundidade) sem varredura N²:**
   - `mapMeshesToComponents` armazena apenas raízes de componente em `WeakMap<Object3D, string>`, permitindo que `resolveComponentId(obj)` suba pela cadeia de pais até o componente proprietário mais próximo em microsegundos (0,68 ms para resolver todos os 10.000 objetos).
2. **Virtualização da árvore na UI (`viewer-panels.tsx`):**
   - Quando a lista visível ultrapassa 100 linhas (`virtualThreshold = 100`), o painel de Estrutura renderiza apenas a janela visível (`height / 32px` + overscan de 8 itens), evitando milhares de nós DOM simultâneos em modelos de 1.000 e 10.000 peças.
3. **Renderização sob demanda e destaque não destrutivo (`viewport.tsx`):**
   - `<Canvas frameloop="demand" dpr={[1, 1.5]}>` só redesenha quadros em eventos de câmera, visibilidade, seleção ou hover.
   - Materiais originais do GLB nunca são mutados nem descartados prematuramente; variantes de seleção/hover são reutilizadas por material de origem em cache dedicado e descartadas na troca ou desmontagem da cena.

## 3. Limitações Conhecidas

- Os números acima medem importação, validação e estruturas em memória CPU no Node.js 22 sem instanciamento WebGL real de GPU para 10.000 draw calls individuais.
- Cenas reais com 10.000 draw calls não-instanciadas dependem do orçamento de GPU/driver do dispositivo; instanciamento (`InstancedMesh`) ou LOD permanecem candidatos para etapas futuras se modelos reais da Casa Gerassi exigirem.


## 4. Métricas da Vista Explodida — Sprint 04 (V0.4)

**Script reproduzível:** `node --experimental-strip-types geogenviewer/scripts/benchmark-explode.mjs`  
**Comparação:** utiliza cenas sintéticas equivalentes (100, 1.000 e 10.000 componentes) para medir preparação do `ExplodedViewController`, média por frame durante 60 quadros de animação contínua (`applyFactor`), atualização em lote único do buffer `Float32Array` das linhas de referência e restauração exata ao fator zero (`reset`).

| Componentes | Preparo + Snapshot (ms) | `applyFactor` médio / frame (ms) | Linhas de Ref. em lote / frame (ms) | `reset()` (ms) | Δ Heap Node (MB) |
|---:|---:|---:|---:|---:|---:|
| 100 | 3,16 | 0,135 | 0,019 | 0,050 | -3,78 |
| 1.000 | 4,01 | 0,113 | 0,008 | 0,063 | 5,41 |
| 10.000 | 35,87 | 1,118 | 0,127 | 1,185 | -20,31 |

*(Nota: métricas medidas em CPU no Node.js 22 sem renderização GPU/rasterização WebGL real de 10.000 draw calls individuais; ver `EXPLODED_VIEW_ENGINE.md` para detalhes de alocação zero por quadro.)*
