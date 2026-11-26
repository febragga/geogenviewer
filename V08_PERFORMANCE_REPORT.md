# GeoGenViewer V0.8 — desempenho

## CPU

O benchmark usa um GLB sintético por escala, com ocorrências de geometria compartilhada e tipos autorados. A carga inclui validação e snapshot de repouso. A transição mede seis atualizações de matriz no processo Node e a preparação da ficha mede dados, antes da geração das imagens. As medições foram feitas em Windows x64 com Node 22.14.0.

| Ocorrências | Carga | Catálogo | Agrupamento | Grade | Alteração de parâmetros | Seis poses | Busca | Dados da ficha | Modelo de callouts |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 6,780 ms | 0,680 ms | 0,747 ms | 1,329 ms | 0,797 ms | 3,977 ms | 0,549 ms | 0,116 ms | 0,234 ms |
| 1.000 | 36,496 ms | 4,634 ms | 2,049 ms | 7,022 ms | 3,971 ms | 14,135 ms | 5,104 ms | 1,605 ms | 0,972 ms |
| 10.000 | 402,667 ms | 32,877 ms | 17,213 ms | 30,868 ms | 22,904 ms | 60,303 ms | 49,415 ms | 6,624 ms | 8,949 ms |

O heap do processo antes do descarte aumentou 7,343, 11,968 e 119,420 MiB respectivamente. O único buffer de geometria usado em cada escala emitiu o evento de descarte. A liberação medida no processo levou 0,151, 0,407 e 2,352 ms. O heap inclui alocações transitórias. A memória da placa de vídeo não foi estimada. [Dados CPU V0.8](docs/v08/evidence/cpu.json)

## Navegador e linha de base

A linha de base reproduzida da V0.7, com dois modelos de 10.000 peças em comparação, registrou 20.000 draw calls, 240.000 triângulos e 1.708 ms para carregar ambos e chegar ao diff na suíte. O cenário V0.8 usa um modelo e uma vista. As contagens descrevem cargas diferentes. [Linha de base V0.7](docs/v08/evidence/baseline-v07-browser.json)

O navegador usa Chrome com SwiftShader. Os tempos de carga e layout, primeira miniatura, busca, preparação da ficha e exportação são de parede. Incluem coordenação do Playwright e custos da interface. Os contadores de materiais são os da viewport ativa. [Dados do navegador V0.8](docs/v08/evidence/browser.json)

| Ocorrências | Carga e disposição | Primeira miniatura | Busca e seleção | Ficha com imagens | PNG da ficha | Draw calls com e sem callouts | Triângulos | Geometrias / materiais |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 775 ms | 370 ms | 362 ms | 989 ms | 1.286 ms | 101 | 1.200 | 2 / 2 |
| 1.000 | 699 ms | 277 ms | 465 ms | 1.243 ms | 1.219 ms | 1.001 | 12.000 | 2 / 2 |
| 10.000 | 1.270 ms | 562 ms | 1.113 ms | 1.086 ms | 1.050 ms | 10.001 | 120.000 | 2 / 2 |

O laboratório de 15 ocorrências registrou 22 draw calls, 252 triângulos, 16 geometrias e três materiais. A repetição da miniatura reaproveitou a imagem armazenada. A mudança para o modo técnico gerou uma nova imagem. [Validação de cache](docs/v08/evidence/browser.json)

O overlay de callouts usa Canvas 2D. O benchmark registra draw calls com e sem labels, e o tempo de preparar seu modelo aparece na tabela de CPU. A projeção e a composição em tela continuam como trabalho da CPU. Contornos técnicos das miniaturas são gerados por pedido e descartados depois da leitura; eles não entram na contagem normal da vista principal.

Os gargalos para a V0.9 são o número de desenhos em cenas com muitas ocorrências, a atualização de pose de muitas peças, a busca em metadados e o custo de ler render targets. As medições sintéticas com software gráfico caracterizam o ambiente testado. A fluidez em modelos reais e tablet físico depende de medições no dispositivo.

Execute `npm run benchmark:v08` em `geogenviewer/`. Para medir o navegador, use o build de produção e `GEOGEN_V08_GPU=1` com `npm run test:v08`.
