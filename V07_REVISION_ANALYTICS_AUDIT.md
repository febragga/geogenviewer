# Auditoria V0.7

A base local é `4008b9f`, tag `v0.6.0`, com árvore limpa antes da criação da branch de trabalho. `main` e `origin/main` apontavam para a consolidação. O último commit da antiga branch de inspeção, `8892df9`, aparece como ancestral direto. O Root Directory do Vercel permanece `geogenviewer/`.

## Linha de base executada

Node 22.14.0 com Chromium/Chrome e SwiftShader. Os 33 testes unitários, typecheck, ESLint, build e as três suítes Playwright (`test:ui`, `test:v05`, `test:v06`) passaram no código V0.6. Os estados axe avaliados apresentaram zero violações. O pavilhão reproduziu 24 draw calls e 276 triângulos na vista única, 96 draw calls e 1.104 triângulos em quatro vistas, duas geometrias e sete materiais. O laboratório de inspeção apresentou 19 draw calls e 584 triângulos em vista única com corte desativado.

## Fronteiras verificadas

| Área | Implementação V0.6 | Consequência para a V0.7 |
| --- | --- | --- |
| Importação e identidade | `LoadedScenePackage` valida o manifesto e hash e guarda resolução do componente mais próximo | Cada revisão retém seu próprio pacote e mapa de IDs |
| SceneGraph | `ComponentRecord` modela ocorrências, camada, grupos, bloco e CAD | Uma travessia registra a malha no proprietário sem contar descendentes duas vezes |
| Picking e visibilidade | Picking por região e clipping. Estados de filtros, isolamento e seleção com escopo por região | A comparação resolve lado e ID; filtros e planos existentes são aproveitados |
| Apresentação | Um Canvas, regiões com scissor, OrbitControls e `SceneDisplay` | Reutilizar rig, passes e buffers em um único Canvas. Uma cena de comparação separa pose e materiais |
| Montagem e explosão | Controladores aplicam poses temporárias sobre objetos | Capturar matrizes de repouso antes de entregar o pacote à apresentação |
| Inspeção e preferências | Identidade binária, âncoras por nó/instância e preferências locais leves | Validar a inspeção em sua revisão e exigir revisão explícita de equivalência |
| Recursos GPU | Geometrias compartilhadas dentro do GLB. Variantes de material descartáveis | Compartilhar recursos importados em cada cena, remover variantes e pacote ao substituir ou remover arquivos |
| Proveniência | Campos escalares CAD/malha/autorados, dimensões e referências explícitas | Segregar subtotais, validar fontes e evitar que material de renderização implique propriedades físicas |

Foi considerada a opção de manter dois Canvas. O custo de dois contexts e duas cópias de recursos gráficos eliminou essa alternativa. Uma cena analítica no Canvas existente preserva o pick independente por revisão e resolve a sobreposição por passe no mesmo contexto. A estratégia de alterar os objetos ativos diretamente também foi considerada, com risco de misturar poses, clipping e visibilidade de apresentação. A implementação usa cópias de nós de renderização com buffers de origem compartilhados por revisão.
