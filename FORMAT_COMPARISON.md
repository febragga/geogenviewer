# GeoGenViewer — Comparação de Formatos de Intercâmbio 3D

**Revisão:** 1.0 · 25/11/2026  
**Escopo:** Fase C da Sprint 03 — avaliação comparativa de formatos para transporte entre Rhino/Grasshopper (e futuras origens) e o visualizador web GeoGenViewer.

---

## 1. Critérios de avaliação

Para atender ao caso de uso principal (maquete desmontável da Casa Gerassi no Rhino 8, peças pré-fabricadas, inspeção em desktop e tablet, processamento 100% local no navegador e extensibilidade para outras origens CAD), cada formato foi avaliado em:

1. **Precisão geométrica e unidades** (NURBS vs malha tessellada, preservação de escala e origem).
2. **Identidade e hierarquia** (GUIDs, camadas, subcamadas, grupos múltiplos, blocos/instâncias).
3. **Metadados CAD e fabricação** (área, volume, centroide, User Text/Strings, propriedades autoradas).
4. **Materiais e renderização GPU** (PBR, cores de camada, instancing, custo de decodificação no navegador).
5. **Tamanho, complexidade de runtime e compatibilidade WebGL/Three.js**.

---

## 2. Matriz comparativa

| Critério | **GLB puro (glTF 2.0)** | **GLB + Manifesto JSON** *(Escolhido)* | **3DM nativo (`rhino3dm.js` / WASM)** | **IFC (`web-ifc` / STEP)** | **JSON geométrico CraftBot** |
|---|---|---|---|---|---|
| **Precisão geométrica** | Malha tessellada em metros (RH Y-up); precisão controlada na tesselação | Malha tessellada em metros + medidas CAD exatas com proveniência (`cad` / `mesh` / `authored`) no JSON | **Exact NURBS/Brep** nativo do Rhino (mas exige tesselação no browser ou render meshes embutidas no `.3dm`) | Sólidos/extrusões paramétricas BIM (esquema complexo IFC2x3/IFC4) | Malha ou caixas 3×4 em JSON texto; arredondamento fixo (5 casas no exportador auditado) |
| **Unidades e eixos** | Padronizado em metros, Y-up, mão direita | Metros no GLB + `sourceUnit`/`sourceUpAxis`/`sourceOrigin`/`scaleDenominator` no JSON | Preserva unidade e Z-up originais do Rhino | Preserva unidades de projeto BIM | Sem padrão universal entre exportadores |
| **Hierarquia** | Árvore única de nós (não suporta bem grupos sobrepostos) | Nós GLB ligados por ID + árvore de layers/sublayers + **múltiplos `groupIds` por elemento** | Completa (layers, sublayers, grupos, blocos) | Espacial predial (Site/Building/Storey), pouco natural para maquete paramétrica/fabricação | Lista plana com índice de camada e coleção única |
| **Identidade persistente** | Nomes de nó não únicos; `extras` opcionais dependem do exportador | `geogenElementId` estável + `sourceObjectId` (GUID Rhino) + fallback explícito por caminho/nome | GUID nativo do Rhino (`ObjectAttributes.Id`) | GlobalId (IFC GUID) | Sem GUID nativo garantido entre revisões (pareamento heurístico no viewer auditado) |
| **Materiais** | PBR glTF 2.0 nativo | PBR no GLB + tabela semântica de materiais (densidade/custo futuros) no JSON | Materiais Rhino (nem sempre PBR direto para WebGL) | Materiais BIM básicos/PBR limitados | Apenas índices de camada/material simples |
| **Instâncias / Blocos** | Suporta compartilhamento de malha e `EXT_mesh_gpu_instancing` | Compartilhamento no GLB + ocorrências individuais rastreadas por ID estável no manifesto | InstanceDefinition / InstanceObject nativos | MappedItem | Instancing por caixas 3×4 no viewer |
| **Tamanho e carregamento** | Compacto binário; parsing rápido no `GLTFLoader` | GLB binário + JSON leve (tipicamente < 10% do GLB) | Arquivos `.3dm` com NURBS + render meshes costumam ser bem maiores | Verbosidade alta (STEP ASCII) ou exigência de parser WASM pesado | Textual JSON; maior que binário GLB para malhas arbitrárias densas |
| **Complexidade de runtime no browser** | Baixa (`three` nativo) | **Baixa/Média** (`GLTFLoader` + `Ajv` JSON Schema) | Alta: exige `rhino3dm.js` (~WASM de vários MB), worker e conversão de Breps sem render mesh | Alta: exige `web-ifc` WASM + normalização de esquemas BIM pesados | Baixa em JS puro, porém acoplado ao pipeline Python/Blender do autor |
| **Dependência de ferramenta** | Universal (Rhino, Blender, Grasshopper, Three.js) | **Universal** (exportador leve em Python/RhinoCommon ou adaptadores futuros) | Exclusivo do ecossistema Rhino/openNURBS | Focado em BIM (Revit/Archicad), excessivo para peças Grasshopper | Acoplado ao Blender headless e scripts do CraftBot |

---

## 3. Decisão arquitetural: por que manter **GLB + Manifesto JSON**

1. **Separação limpa entre geometria de GPU e semântica de engenharia:** o navegador recebe geometria pronta para WebGL (`model.glb`) via `GLTFLoader` padrão, enquanto propriedades CAD exatas (volume, área, centroide, dimensões de origem, User Text, layers aninhados, múltiplos grupos, etapas futuras de montagem) trafegam em JSON validado por JSON Schema 2020-12 (`manifest.json`), sem inflar buffers de GPU.
2. **Independência de plataforma de origem:** embora o primeiro exportador seja o `GeoGenExporter` em Python/RhinoCommon no Rhino 8, o mesmo contrato aceita adaptadores futuros para Grasshopper, Blender ou scripts procedurais.
3. **Degradação segura:** arquivos `.glb` convencionais sem manifesto continuam abrindo normalmente em **Modo Básico GLB**, enquanto pares `GLB + manifest.json` desbloqueiam a semântica completa sem fallback silencioso caso o manifesto seja inválido.
4. **Preservação de identificação individual:** mesmo quando o GLB compartilha geometria/malha entre instâncias de bloco, cada ocorrência possui nó próprio com identificador vinculado ao elemento no manifesto.

---

## 4. Avaliação de `rhino3dm.js` (possível formato secundário futuro)

`rhino3dm.js` (openNURBS compilado em WebAssembly sob licença MIT) permite ler arquivos `.3dm` diretamente no navegador sem Rhino Compute. Entretanto, sua adoção nesta etapa é **adiada para backlog futuro** pelos seguintes motivos técnicos:

1. **Render meshes não garantidas:** um `.3dm` salvo em modo wireframe ou sem malhas de visualização armazenadas nos Breps/NURBS não pode ser exibido diretamente sem tesselação; `rhino3dm` expõe primariamente acesso à leitura/escrita do modelo de dados openNURBS, enquanto tesselação completa de NURBS arbitrários depende do núcleo geométrico do Rhino (não incluído integralmente no openNURBS gratuito).
2. **Peso de inicialização e memória:** o módulo WASM + transferência de dados para JS aumentam o tempo inicial de carga em tablets e celulares.
3. **Papel futuro recomendado:** oferecer importação secundária experimental de `.3dm` apenas para arquivos salvos com render meshes (ex.: via Web Worker dedicado após v1.0), reutilizando o mesmo modelo de domínio interno (`SceneGraph` / `ComponentRecord`) já validado pelo pipeline GLB + JSON.

---

## 5. Avaliação de pacote `.geogen` (ZIP futuro)

Um contêiner único `.geogen` (arquivo ZIP padronizado contendo `model.glb` + `manifest.json` na raiz) simplificará a seleção de arquivo único no tablet. Ele permanece **opcional e fora da v0.3** para evitar complexidade de descompressão, validação de *zip-slip* (paths maliciosos) e limites de memória pós-descompressão antes que o contrato `model.glb + manifest.json` esteja estabilizado com o `GeoGenExporter`.

---

## 6. Resumo de decisão

- **Formato primário oficial (v0.1–v1.0):** `model.glb` (glTF 2.0 binário autocontido, metros, Y-up) + `manifest.json` (UTF-8, validado por JSON Schema 2020-12).
- **Modo compatibilidade:** `.glb` isolado sem manifesto é aceito em **Modo Básico GLB** com propriedades derivadas apenas de malha e semântica limitada à cena glTF.
- **Formato secundário futuro (Backlog):** `.3dm` via `rhino3dm.js` (somente quando possuir render meshes) e pacote `.geogen` (ZIP validado).
- **Fora do escopo MVP:** IFC completo e JSON proprietário do CraftBot.
