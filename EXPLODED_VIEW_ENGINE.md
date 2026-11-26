# EXPLODED_VIEW_ENGINE.md — Arquitetura e Algoritmos da Vista Explodida (V0.4)

**Data:** 25/11/2026  
**Módulo principal:** [`geogenviewer/src/lib/geogen/explode/controller.ts`](file:///c:/Site-GeoGenViewer/geogenviewer/src/lib/geogen/explode/controller.ts)  
**Consumidor UI/Cena:** [`geogenviewer/src/features/viewer/scene/viewport.tsx`](file:///c:/Site-GeoGenViewer/geogenviewer/src/features/viewer/scene/viewport.tsx) · [`geogenviewer/src/features/viewer/components/explode-panel.tsx`](file:///c:/Site-GeoGenViewer/geogenviewer/src/features/viewer/components/explode-panel.tsx)

---

## 1. Modelo Matemático e Preservação de Transformações

O motor `ExplodedViewController` opera exclusivamente sobre **componentes lógicos** (`scenePackage.objectByComponentId`), nunca quebrando objetos compostos multi-malha nem destruindo geometria compartilhada entre instâncias (`InstancedMesh`/shared geometry).

1. **Snapshot imutável de repouso (`SnapshotEntry`):**
   - No construtor, `scene.updateMatrixWorld(true)` garante matrizes mundiais atualizadas.
   - Para cada componente lógico, armazenam-se:
     - `restLocalPosition`: `Vector3` clonado da posição local original no GLB.
     - `restWorldCenter` e `restWorldBox`: centro e `Box3` no espaço glTF Y-up em repouso.
     - `parentSnapIndex`: índice do componente ancestral mais próximo na hierarquia GLB (`-1` se raiz).
     - `parentInvLinear`: matriz `3×3` inversa da submatriz linear (rotação + escala) do `object.parent.matrixWorld`, protegida contra determinante nulo (`|det| < 1e-12`).
   - As entradas são ordenadas topologicamente por profundidade no grafo GLB (`gltfDepth` crescente) para que o pai seja sempre processado antes do filho.

2. **Fórmula sem deriva acumulada e sem dupla transformação:**
   - Para qualquer `factor >= 0` em `applyFactor(factor)`:
     - Se `factor < 1e-7`, restaura `object.position.copy(restLocalPosition)` para cada componente — retorno exato com erro `0` após qualquer número de ciclos.
     - Para `factor > 0`:
       $$\vec{\Delta}_{world,desejado} = \vec{d}_1 \cdot \text{factor}$$
       $$\vec{\Delta}_{world,líquido} = \vec{\Delta}_{world,desejado} - \vec{\Delta}_{world,aplicado}(\text{pai})$$
       $$\vec{\Delta}_{local} = (M_{\text{pai},3\times 3})^{-1} \cdot \vec{\Delta}_{world,\text{líquido}}$$
       $$p_{\text{local}} = p_{\text{repouso}} + \vec{\Delta}_{local}$$
   - Se o pai move e um subcomponente filho está **fora do escopo**, o termo $-\vec{\Delta}_{world}(\text{pai})$ cancela o movimento do pai no nó filho, mantendo o filho parado em coordenadas mundiais. Se pai e filho movem no mesmo grupo, o deslocamento do pai não é somado duas vezes.

3. **Conversão de coordenadas CAD ↔ glTF (`EXPORTER_CONTRACT.md`):**
   - `cadVectorToGltf([dx, dy, dz]) = [dx, dz, -dy]`
   - `cadAxisToGltf("X") = (1, 0, 0)` · `cadAxisToGltf("Y") = (0, 0, -1)` · `cadAxisToGltf("Z") = (0, 1, 0)` (Z vertical CAD mapeado para +Y no glTF).

---

## 2. Modos, Escopo e Granularidade

| Parâmetro | Opções | Comportamento |
|---|---|---|
| **Modo (`mode`)** | `radial`, `axial`, `directional`, `hierarchical` | **Radial** afasta do centro de referência do escopo (com detecção de clusters coincidentes via quantização espacial em mm e fallback determinístico pelo ângulo áureo). **Axial** projeta sobre X/Y/Z CAD ordenando clusters simetricamente. **Direcional** usa vetor CAD `(dX, dY, dZ)` ou, quando `useManifestHints` e vetor padrão `[0,0,1]` estão ativos em manifesto v1.0.0, aproveita `explodeOffsetM` / `assemblyDirectionM`. **Hierárquica** escalona separação conforme `logicalDepth + layerDepth`. |
| **Escopo (`scope`)** | `all`, `selection`, `layer`, `group` | Restringe *quais* componentes recebem $\vec{d}_1 \neq 0$. Camadas aninhadas incluem sublayers recursivamente. |
| **Granularidade (`granularity`)** | `component`, `layer`, `group` | Define se clusters são calculados por componente individual, por camada ou por grupo. Na granularidade `group`, um `Set` de atribuição garante que peças pertencentes a múltiplos grupos sobrepostos movam apenas uma vez. |

---

## 3. Linhas de Referência em Lote Único e Animação sem Re-renders

- **Linhas de referência (`SceneController`):** um único `THREE.LineSegments` com `Float32Array(componentCount * 6)` pré-alocado e `LineDashedMaterial` sincronizado com a cor do tema (`#1D5F82` claro / `#89C8FA` escuro). Possui `raycast = () => {}` para nunca interceptar cliques/toques e colapsa segmentos de componentes ocultos/inativos a comprimento zero sem realocar buffers.
- **Animação 60fps (`useFrame`):** transições entre presets/Play avançam via `useFrame` (curva quadrática ease-in-out) com `frameloop="demand"` disparando `invalidate()` por quadro. O valor numérico/slider no [`ExplodePanel`](file:///c:/Site-GeoGenViewer/geogenviewer/src/features/viewer/components/explode-panel.tsx) recebe atualizações diretas via listener imperativo sem re-renderizar a árvore ou spammar o Zustand por frame. Em `prefers-reduced-motion: reduce`, transições aplicam o fator final instantaneamente.
- **Enquadramento (`Fit`):** `applyCameraCommand` usa `controller.computeBounds({ exploded: controller.factor > 1e-6, targetIds, hiddenSet, isolatedSet })`, considerando a posição visual explodida e os filtros de visibilidade.

---

## 4. Limitações Atuais (Escopo V0.4)

- A vista explodida V0.4 não ordena dependências de montagem passo a passo (`assembly.steps[].dependsOn`) nem detecta colisões físicas — recursos reservados para V0.5+.
- A edição individual manual de vetores peça a peça por gizmo 3D não faz parte desta etapa (modo `directional` aceita vetor CAD global ou `explodeOffsetM` vindo do manifesto v1.0.0).
- **Schema:** nenhuma alteração foi feita no contrato externo `manifest.schema.json` / `EXPORTER_CONTRACT.md` (sem necessidade de `SCHEMA_EXTENSION_PROPOSALS.md`).
