# GeoGenViewer V0.6 — desempenho

## Base reproduzida e comparação

No `42f0b89`, a execução V0.5 registrou 24 draw calls em vista única e 96 em quatro vistas, 276 e 1.104 triângulos, duas geometrias GPU e sete materiais. A carga do pavilhão registrou 20 ms. O benchmark de pose V0.5 de 10.000 peças registrou p95 de 0,317 ms normal e 9,406 ms com ghost. A auditoria V0.6 voltou a observar os mesmos contadores de desenho e geometria do pavilhão em um contexto WebGL. As execuções isoladas da regressão V0.5 no código V0.6 registraram 18–28 ms de carga. A última marcou 26 ms. A rodada final, após o fluxo de captura, registrou 706 ms no pavilhão. A origem específica dessa diferença não foi isolada, portanto a comparação de latência permanece inconclusiva.

| Cena e configuração na V0.6 | Draw calls | Triângulos enviados ao renderer | Geometrias GPU em cache | Materiais na vista ativa |
|---|---:|---:|---:|---:|
| Pavilhão único sem corte | 24 | 276 | 2 | 7 |
| Pavilhão quad sem corte | 96 | 1.104 | 2 | 7 |
| Laboratório sem corte | 19 | 584 | 17 | 5 |
| Laboratório com corte preenchido e contorno | 21 | 2.178 | 24 | 7 |
| Laboratório em quad com três regiões seccionadas | 82 | 7.118 | 24 | 7 |

Os contornos espessos são rasterizados por `LineSegments2` e ampliam a contagem de triângulos emitidos. A memória do renderer inclui buffers recentes de seções. A GPU continua usando as mesmas geometrias do GLB entre as regiões. O shader descarta fragmentos, portanto o contador de triângulos enviados inclui partes recortadas.

O teste mede a duração do acionamento do download PNG de 1280 px até a gravação pelo Playwright. As duas últimas rodadas registraram de 563 a 1.709 ms no fundo branco e de 417 a 1.141 ms no transparente. A métrica inclui o pipeline gráfico e a gravação do artefato pelo teste no ambiente headless. O objeto de comparação é o mesmo laboratório de 17 componentes. O relatório JSON da suíte registra também a duração da rodada mais recente. Uma leitura instantânea do diagnóstico em Chrome/SwiftShader é insuficiente para estimar FPS sustentado em dispositivo físico. [Dados da auditoria](geogenviewer/test-results/v06/results.json)

## Benchmark CPU

Execute `npm --prefix geogenviewer run benchmark:v06`. A execução registrada usou Node 22.14.0, Windows 10.0.26300 e Intel Core 7 240H. A cena usa caixas com geometria e material compartilhados e distribuição regular. Os tempos de preparação medem alocação e matrizes no processo Node. O raycast passa pelas peças e seleciona o primeiro hit preservado. O snap usa uma face candidata. A geração de seção testa a coleção inteira e o plano intercepta cerca de 5% das caixas.

| Componentes | Preparo (ms) | Picking p95 (ms) | Snap p95 (ms) | Planos p95 (ms) | Contornos e preenchimento p95 (ms) |
|---:|---:|---:|---:|---:|---:|
| 100 | 2,341 | 0,179 | 0,0065 | 0,0011 | 0,635 |
| 1.000 | 7,774 | 0,097 | 0,0043 | 0,0008 | 2,268 |
| 10.000 | 47,127 | 0,747 | 0,0065 | 0,0011 | 12,256 |

Esses tempos representam o cenário sintético. Conjuntos com tesselação densa, múltiplos planos e mais peças cortadas aumentam o custo de reconstrução. Câmera e hover reaproveitam as seções já calculadas. Em arraste ou animação, a atualização contínua usa clipping shader e reconstitui as superfícies ao final. O custo de captura inclui renderização offscreen, leitura, composição e codificação. O backend permanece local.
