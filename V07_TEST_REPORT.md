# GeoGenViewer V0.7 — verificação

## Cobertura automatizada

Os 45 testes unitários incluem 33 regressões e 12 casos de V0.7. Exercitam identidade, colisões de IDs entre revisões, ambiguidades, decisões manuais, GLB-only, transformações, tolerância, tesselação, inversão de alinhamento, ocorrências, compósitos, grupos sobrepostos, dados ausentes, fabricação, inspeções e documentos. `lint`, `typecheck` e `build` foram executados com Node 22.14.0.

A suíte V0.7 usa arquivos sintéticos e verifica carregamento simultâneo, modos de comparação, correspondência manual, alternância de revisão, inspeções, seleção por tabela, versões de documento e cinco formatos de download. O teste de clipping compara PNGs em enquadramentos equivalentes. A análise axe cobre estados claros e escuros. [Roteiro](geogenviewer/scripts/verify-v07.mjs) · [Dados da execução](docs/v07/evidence/browser.json)

## Resultado

- `npm test` passou com 45 testes. `npm run lint`, `npm run typecheck` e `npm run build` passaram.
- `test:ui`, `test:v05`, `test:v06` e `test:v07` passaram. O pavilhão manteve 24 draw calls em vista única e 96 em quad. A última auditoria V0.7 incluiu os três conjuntos de escala.
- As seis dimensões da comparação apresentaram um Canvas, um contexto WebGL e zero overflow horizontal. Quantitativos também foi verificado sem overflow nas duas dimensões touch menores. As oito avaliações axe da V0.7 retornaram zero violações.
- A captura lado a lado teve 236.145 pixels com cor acima do limiar do teste e 133.146 após clipping no mesmo enquadramento. Os dois PNGs e os quatro relatórios CSV/JSON foram baixados com sucesso.
- `npm run fixture:revision` regenerou os arquivos sem alterar o diff do Git.

## Capturas reais

| Resolução | Evidência |
| --- | --- |
| 1920 × 1080 | [Comparar](docs/v07/evidence/comparar-1920x1080.png) |
| 1440 × 900 | [Comparar](docs/v07/evidence/comparar-1440x900.png) |
| 1280 × 800 | [Comparar](docs/v07/evidence/comparar-1280x800.png) |
| 1024 × 768 | [Comparar](docs/v07/evidence/comparar-1024x768.png) |
| 768 × 1024 | [Comparar](docs/v07/evidence/comparar-768x1024.png) |
| 390 × 844 | [Comparar com revisão alternável](docs/v07/evidence/comparar-390x844.png) |

- [Tabela em 768 × 1024](docs/v07/evidence/quantitativos-768x1024.png) · [Tabela em 390 × 844](docs/v07/evidence/quantitativos-390x844.png).
- [Lado a lado no tema claro](docs/v07/evidence/comparar-lado-a-lado.png) · [Sobreposição e seleção](docs/v07/evidence/comparar-sobreposicao.png) · [Quantitativos entre protótipos](docs/v07/evidence/quantitativos-analise.png).
- [Captura PNG exportada pelo aplicativo](docs/v07/evidence/comparacao.png) · [Captura com clipping](docs/v07/evidence/comparacao-com-corte.png) · [CSV e JSON de exemplo](docs/v07/examples/).

Os casos touch foram emulados no navegador. As homologações com tablet físico, Rhino 8 e materiais autorizados da Casa Gerassi permanecem pendentes.
