
# GeoGenViewer V0.9.1 — renderização

Um Canvas R3F e um contexto WebGL atendem as viewports. Compare alterna regiões dentro do mesmo Canvas. O Navigation Cube projeta 26 superfícies em SVG, com direção derivada da câmera ativa. Thumbnails e imagens técnicas usam alvos offscreen no renderer da viewport.

## Instancing

O lote só combina malhas de geometria e material compartilhados e passa a valer com pelo menos 24 candidatas. A elegibilidade exige material opaco, profundidade ativa e matriz representável sem espelhamento ou cisalhamento. Malhas deformadas, malhas já instanciadas, descendentes de malha, ancestrais ocultos, transmissivos e materiais múltiplos seguem o caminho de origem. Atributos de instância representam a matriz relativa ao host e a cor por peça. Compare mantém a matriz explícita da ocorrência no espaço da revisão.

Cada slot conhece a malha e a ocorrência. Mudar as matrizes invalida os limites de raycasting. Picking consulta renderizáveis visíveis e lotes ativos, descarta interseções recortadas e reconstitui a malha de origem para ancoragem. Instâncias glTF nativas continuam com seus próprios IDs locais. Ghosts, arestas técnicas, modo x-ray e opacidade reduzida usam malhas individuais quando necessário.

## Render sob demanda

Câmeras, controles, mudança de estado, animações e diagnósticos invalidam o frame. O viewport mantém scissor, clipping e estado ativo por região. Os ensaios registram intervalos entre frames de um gesto sintético, contagem em repouso e draw calls separadamente da latência de carregamento.

A aceleração espacial geral e batching de geometrias diferentes seguem no backlog. O raycasting de um lote ainda visita seus slots. [Medições](V091_PERFORMANCE_REPORT.md)
