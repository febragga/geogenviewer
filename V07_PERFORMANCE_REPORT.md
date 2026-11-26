# GeoGenViewer V0.7 — desempenho

O benchmark em Node forma dois GLBs sintéticos por escala. Cada modelo usa caixas com geometria compartilhada. Doze por cento das peças têm diferenças de pose ou escala. A carga inclui geração de entrada, leitura GLB + manifesto, validação do hash e snapshot de repouso. Os tempos representam uma execução em Windows x64 com Node 22.14.0.

| Componentes por revisão | Carga de A e B | Correspondência | Geometria e diff | Quantitativos e fabricação | Filtro | Dados da tabela | Heap antes do descarte | Descarte |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 15,067 ms | 0,199 ms | 3,742 ms | 1,286 ms | 0,014 ms | 0,042 ms | +5,390 MiB | 0,153 ms |
| 1.000 | 87,663 ms | 0,465 ms | 25,338 ms | 8,866 ms | 0,069 ms | 0,140 ms | +22,229 MiB | 0,636 ms |
| 10.000 | 612,572 ms | 6,695 ms | 124,639 ms | 64,683 ms | 0,773 ms | 0,820 ms | +186,317 MiB | 2,826 ms |

O heap é a diferença de `heapUsed` entre o início e o fim do processamento, antes de descartar as cenas. A medição inclui alocações transitórias do processo e exclui memória GPU. Nas três escalas, os dois buffers de geometria utilizados emitiram seus eventos de descarte. [Dados CPU](docs/v07/evidence/cpu.json)

A primeira medição da análise em 10.000 ocorrências mostrou custo concentrado na repetição do cálculo topológico por peça. O cache por buffer e matriz linear reutiliza as métricas de peças com a mesma geometria e escala e preserva cada ocorrência no total. O diff usa lotes cooperativos. A janela da tabela permanece limitada às linhas próximas da área visível.

## Navegador

A linha de base reproduzida da v0.6 registrou 24 draw calls, 276 triângulos e duas geometrias em vista única, e 96 draw calls, 1.104 triângulos e duas geometrias em quatro regiões. A fixture de revisões usa dois modelos distintos, com até dois passes de scissor. A comparação depende da quantidade de objetos visíveis, do enquadramento e da transparência. [Auditoria de base](V07_REVISION_ANALYTICS_AUDIT.md)

A suíte usa Chrome com SwiftShader em uma viewport de 1440 × 900 para a escala. A carga observada inclui seleção Playwright dos dois pacotes locais e espera pelo resultado. A atualização da tabela inclui preencher a pesquisa, aguardar a linha e checar a contagem semântica. Os contadores de material descrevem a região ativa. A geometria GPU depois da remoção inclui o auxiliar de eixos da cena normal. [Dados do navegador](docs/v07/evidence/browser.json)

| Componentes por revisão | Carga e análise (parede) | Pesquisa na tabela (parede) | Draw calls lado a lado → base | Triângulos lado a lado → base | Geometrias / materiais na comparação |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 551 ms | 118 ms | 200 → 101 | 2.400 → 1.200 | 2 / 2 |
| 1.000 | 725 ms | 159 ms | 2.000 → 1.001 | 24.000 → 12.000 | 2 / 2 |
| 10.000 | 4.082 ms | 170 ms | 20.000 → 10.001 | 240.000 → 120.000 | 2 / 2 |

O laboratório de 21 componentes por revisão registrou 44 draw calls, 544 triângulos, 10 geometrias e 6 materiais na região ativa lado a lado. A sobreposição com transparência registrou 66 draw calls, 834 triângulos, 10 geometrias e 15 materiais. Os contadores da vista única e quad do pavilhão continuaram iguais aos da base V0.6. Os tempos de carga do pavilhão variaram entre rodadas e os dados não isolam a causa dessa variação.

Uma cena real com tesselação densa, transparência, texturas ou muitos materiais pode ter outro perfil. O maior conjunto ainda envia vários milhares de draw calls por quadro. A medição em SwiftShader caracteriza o teste local e a calibração de fluidez real depende do dispositivo e dos arquivos.

Para reproduzir, execute `npm run benchmark:v07` em `geogenviewer/`. Para o navegador, use `npm run build` seguido de `npm run test:v07` com `GEOGEN_V07_GPU=1`.
