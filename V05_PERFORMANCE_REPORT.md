# GeoGenViewer V0.5 — desempenho

## Montagem em CPU

Execute `npm --prefix geogenviewer run benchmark:v05`. A execução registrada usou Node.js 22.14.0, Windows 10.0.26300 e Intel Core 7 240H. A cena sintética distribui as peças em dez passos e compartilha geometria e material. O script mede a compilação e a captura de poses, seguidas de 480 amostras temporais por modo, com 120 para aquecimento.

| Componentes | Preparo (ms) | Normal, mediana / p95 (ms) | Ghost, mediana / p95 (ms) |
|---:|---:|---:|---:|
| 100 | 0,986 | 0,008 / 0,028 | 0,008 / 0,026 |
| 1.000 | 2,384 | 0,008 / 0,017 | 0,053 / 0,097 |
| 10.000 | 12,244 | 0,188 / 0,251 | 1,259 / 2,976 |

A medição cobre o cálculo e a aplicação local da pose no Three.js. O custo gráfico de transparência, desenho e upload à GPU é medido separadamente pelo navegador quando o modelo é manipulado.

## Cena e viewport no navegador

Execute `npm --prefix geogenviewer run build` seguido de `npm --prefix geogenviewer run test:v05`. O cenário usa o pavilhão sintético com 18 componentes, 23 malhas, 276 triângulos e o modo Sombreado. A janela é 1440 × 900, com Canvas de 882 × 856 CSS px. O Chrome headless usou ANGLE sobre Vulkan SwiftShader.

| Layout | Contextos | Geometrias GPU | Materiais em cena | Draw calls | Triângulos desenhados |
|---|---:|---:|---:|---:|---:|
| Única | 1 | 2 | 7 | 24 | 276 |
| Quatro vistas | 1 | 2 | 7 | 96 | 1.104 |

O custo de desenho cresce com o número de regiões. A geometria, os materiais e o contexto permanecem compartilhados. A carga do pavilhão registrou 23 ms na execução final e 20 a 26 ms nas rodadas anteriores. O FPS no estado de repouso aparece como indisponível por causa do loop sob demanda. A execução headless confirma métricas de recursos e fluxo. Ela é insuficiente para estimar taxa de quadros em iPad ou Android.

O modo Desempenho fixa DPR 1. Equilibrada limita a 1,5 e Alta a 2. Sombras, grade, plano de chão e arestas são opcionais. O modo Técnico gera as arestas uma vez por geometria e as libera na troca de modelo. [Dados da execução](geogenviewer/test-results/v05/results.json)
