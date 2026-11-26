# Interoperabilidade GeoGenExporter / GeoGenViewer V0.7

A V0.7 lê o manifesto CAD 1.0.0 e roda com o pacote GLB local. As duas APIs de documentos analíticos são independentes. A fixture usa campos existentes de manifesto, propriedades escalares e `userText`. A compatibilidade deste fluxo foi verificada com a fixture sintética.

| Propriedade explicitamente reconhecida | Interpretação no visualizador |
| --- | --- |
| `GeoGen:PartId` | Identificação autorada para sugestão e agrupamento |
| `GeoGen:FabricationCode` | Sugestão alternativa de correspondência |
| `GeoGen:TypeCode` | Agrupamento por tipo declarado |
| `GeoGen:Fabrication:VolumeM3` | Volume autorado em m³ |
| `GeoGen:Fabrication:SlicerMassKg` | Massa do slicer em kg |
| `GeoGen:Fabrication:MeasuredMassKg` | Massa física em kg |
| `GeoGen:Fabrication:EstimatedMassKg` | Estimativa autorada em kg |
| `GeoGen:Fabrication:MachineTimeSeconds` | Tempo de máquina em segundos |
| `GeoGen:Fabrication:EstimatedProductionSeconds` | Estimativa de produção em segundos |
| `GeoGen:Fabrication:RecordedTimeSeconds` | Tempo registrado em segundos |

O painel permite apontar as seis propriedades de massa e tempo para chaves alternativas. É preciso confirmar que os valores têm as unidades acima. O código rejeita negativos e valores não finitos e registra a chave usada na análise. `fabrication.material` indica o material físico e pode referenciar uma entrada CAD pelo ID ou nome ou uma entrada autorada pelo código. `materialId` visual isolado não é usado para estimativa física.

Para futura revisão conjunta com o exportador, vale verificar a estabilidade de IDs em blocos aninhados, a semântica de chaves autoradas por ocorrência, as unidades dos dados de slicer e a distinção entre origem rebaseada e transformação incorporada aos vértices. A homologação do Rhino 8 segue pendente.
