# EXPLODED_VIEW_RESEARCH.md — Investigação de Vistas Explodidas (Fase B)

**Data:** 25/11/2026  
**Sprint:** 04 — V0.4 Exploded View Engine  
**Objetivo:** consolidar padrões técnicos de vista explodida adotados em ferramentas CAD/BIM/WebGL (CraftBot, Inventor, Fusion, SolidWorks, Shapr3D, Onshape, Rhino, Blender e Speckle) e definir fronteiras claras para o `ExplodedViewController` do GeoGenViewer.

---

## 1. Análise do CraftBot (revisão auditada `2d52c09288c34f8b0e95157c213c4ed883ef59eb`)

Conforme a auditoria estática registrada em [CRAFTBOT_ANALYSIS.md](file:///C:/Site-GeoGenViewer/CRAFTBOT_ANALYSIS.md):

1. **Separação de poses e estado base:**
   - Em `viewer/js/knolling.js` e `viewer/js/animations.js`, o CraftBot mantém poses originais e alvos calculados separadamente para evitar deriva acumulada durante interpolação.
   - A câmera permanece estável enquanto elementos se movem ou filtram por camada, preservando referência espacial.
2. **Picking e estados mutuamente exclusivos:**
   - No CraftBot, *knolling* e animação de montagem disputam a mesma posse espacial dos objetos. Durante transições, o picking é suspenso ou protegido contra estados inválidos.
3. **Limitações para o GeoGenViewer:**
   - O CraftBot trabalha com caixas/malhas exportadas do Blender em espaço mundial com matrizes 3×4 já achadas e camadas inferidas por nome.
   - O GeoGenViewer recebe GLB 2.0 hierárquico exportado do Rhino 8 (`manifest.json` v1.0.0) contendo compósitos multi-malha, instâncias de bloco, grupos sobrepostos e transformações locais aninhadas — portanto **não** podemos simplesmente somar deltas em coordenadas mundiais diretamente no `position` local sem compensar escala/rotação dos pais e sem isolar transformações acumuladas.

---

## 2. Referências Funcionais CAD / Web

| Ferramenta | Mecanismo principal de Vista Explodida | Lição aplicável ao GeoGenViewer | O que evitar na V0.4 |
|---|---|---|---|
| **Autodesk Inventor / Fusion** | *Presentation/Exploded Views* baseadas em *Tweaks* por componente/submontagem + *Trail Lines* (linhas tracejadas do ponto inicial ao deslocado) com timeline reversível. | Separar fator contínuo (`0..1`) de vetores individuais pré-computados; linhas de referência opcionais e não selecionáveis. | Sequências temporais complexas com múltiplos *tweaks* manuais por curva (fica para V0.5/timeline). |
| **SolidWorks** | *Explode Steps* com alinhamento radial ou axial (`Auto-space components on drag`), mantendo submontagens coesas (*rigid subassembly*) salvo explosão explícita. | Escopo e granularidade distintos: permitir explodir por **componente lógico**, **camada** ou **grupo**, preservando submontagens/compósitos íntegros. | Edição interativa de *explode steps* persistentes em árvore CAD própria. |
| **Onshape** | *Exploded Views* no Assembly mantendo BOM/propriedades e bounding box de inspeção sem mutar o *Assembly* original; seleção continua retornando a instância original. | A vista explodida é estritamente uma **camada de visualização temporária**: IDs, propriedades CAD e dimensões originais permanecem intactos; o painel deixa explícito quando a bounding box global exibida é a da cena explodida. | Recalcular propriedades físicas (volume, área, centroide) na pose explodida. |
| **Shapr3D** | *Visualization / Exploded slider* direto para tablet/touch com resposta imediata a `0–100%`, sem menus modais pesados. | Controle compacto flutuante próximo à toolbar com slider contínuo, presets rápidos (0%, leve, médio, completo) e botão de restaurar instantâneo, amigável ao polegar em tablet. | Sobrecarga de parâmetros técnicos no viewport móvel. |
| **Rhino 8** | Sem vista explodida paramétrica nativa única (feita via `Move`, *NamedPositions* ou Grasshopper). Sistema de coordenadas direito com **Z para cima**. | Ao apresentar controles de eixo (`X`, `Y`, `Z`) na UI, respeitar a convenção CAD definida no `EXPORTER_CONTRACT.md` (**Z vertical no CAD** mapeado corretamente ao eixo `+Y` do espaço glTF Y-up). | Confundir eixo `Y` interno do glTF com eixo `Z` esperado pelo arquiteto no Rhino. |
| **Blender / Speckle** | `Displace` / filtros de isolamento e seleção sincronizada entre cena e árvore; *bounding box* de visíveis para `Fit View`. | Enquadramento (`F` / botão Enquadrar) deve considerar as posições **visuais atuais** quando a vista estiver explodida; árvore não deve ser recalculada por frame de animação. | Recriar geometria, mutar `BufferGeometry` ou atualizar store React/Zustand a 60fps durante animações. |

---

## 3. Distinção Conceitual: Vista Explodida vs. Edição Geométrica vs. Montagem (V0.5)

| Dimensão | Vista Explodida (V0.4) | Edição Geométrica (fora de escopo) | Animação Construtiva (V0.5) |
|---|---|---|---|
| **Natureza** | Transformação visual temporária e reversível sobre poses de repouso. | Alteração de vértices, matrizes de origem, booleanas ou arquivo `.glb`. | Sequência temporal ordenada com dependências (`assembly.steps`, `dependsOn`). |
| **Parâmetro** | Fator contínuo `explosionFactor` (`0.0` = montado → `1.0+` = explodido). | Ferramentas de modelagem/CAD (`Push/Pull`, `Move` permanente). | Linha do tempo discreta/contínua por etapas construtivas. |
| **Direção** | Radial, Axial (CAD X/Y/Z), Direcional (vetor do usuário ou `explodeOffsetM`/`assemblyDirectionM`) ou Hierárquica. | Arbitrária com alteração de arquivo. | Direção de inserção física (`insertionOffsetM`, ordem estrutural fundação→pilar→viga→laje). |
| **Dados de origem** | 100% imutáveis (`restMatrices` em cache; retorno exato ao fator `0.0`). | Mutáveis. | 100% imutáveis. |

---

## 4. Diretrizes de Projeto para o `ExplodedViewController`

1. **Snapshot imutável de repouso (`RestPoseSnapshot`):** capturar na preparação `position`, `quaternion`, `scale`, `matrix`, `matrixWorld` e caixa envolvente mundial de repouso por componente lógico antes de qualquer deslocamento. Ao definir `explosionFactor = 0`, restaurar exatamente `position.copy(restLocalPosition)` — zero deriva acumulada mesmo após centenas de ciclos.
2. **Compensação de hierarquia pai-filho:** como deslocamentos são calculados em coordenadas globais de visualização (`glTF` world meters), o deslocamento líquido aplicado a um componente cujo pai lógico **também** se move no mesmo grupo de explosão deve descontar o deslocamento do pai (ou aplicar deslocamento incremental por nível no modo `hierarchical`), convertendo o delta global líquido para o espaço local do `object.parent` (respeitando rotação e escala não uniforme dos ancestrais).
3. **Escopo vs. Granularidade:**
   - **Escopo** define *quais* componentes participam (`all`, `selection`, `layer`, `group`). Componentes fora do escopo ficam imóveis (`delta = 0`).
   - **Granularidade** define *como* são movidos (`component` — cada peça se afasta individualmente; `layer` — peças da mesma camada compartilham o vetor da camada, preservando subconjuntos internos; `group` — peças de um grupo compartilham o vetor do grupo, deduplicando componentes presentes em múltiplos grupos sobrepostos via resolução determinística sem somar duas vezes).
4. **Distância normalizada adaptativa à escala do modelo:** calcular `referenceSpan = diagonal(sceneBounds)` (fallback seguro para modelos pequenos como maquete `1:50` de `0,5 m` ou edifícios de `50 m`), escalonando a amplitude de referência (`factor = 1.0` ≈ `0,45 × referenceSpan`, ajustada pelo afastamento relativo ao centro de referência).
5. **Convenção de eixos CAD vs. glTF (`EXPORTER_CONTRACT.md`):**
   - Usuário escolhe **Eixo X (CAD)** → vetor glTF `(1, 0, 0)`.
   - Usuário escolhe **Eixo Y (CAD)** → vetor glTF `(0, 0, -1)` (ou direção Y do Rhino).
   - Usuário escolhe **Eixo Z — Vertical (CAD)** → vetor glTF `(0, 1, 0)` (**Y-up** do glTF).
6. **Linhas de referência em lote único:** representar todos os segmentos `origem → posição explodida` em um único `THREE.LineSegments` com `BufferAttribute` pré-alocado (`2 × componentCount` vértices), `raycast = () => null` (nunca intercepta seleção) e ocultação por segmento colapsando os dois vértices quando o componente está oculto ou não deslocado.
