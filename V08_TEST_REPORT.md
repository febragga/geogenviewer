# GeoGenViewer V0.8 — verificação

## Comandos e cobertura

`npm test` executa 55 testes unitários, com 45 regressões e 10 testes da V0.8. Os novos testes verificam os cinco layouts e os três planos, determinismo, folgas, compósitos, escala, espelhamento, fixações, repetição de poses, escopos, agrupamentos por tipo, proveniência, referências de callout e clipping, fichas, montagem autorada e restauração por hash. A fixture pode ser regenerada com `npm run fixture:catalog`.

A auditoria `test:v08` usa o build Next.js de produção. Exercita a transição, seleção, mudança dos modos de organização, fixação, anotações, miniaturas, tabela, comparação individual, fichas, modelo de impressão, PNG, CSV, JSON e rejeição de importação de outra revisão. Verifica um único contexto WebGL nos cenários testados. A CPU e o navegador também foram medidos nas escalas de 100, 1.000 e 10.000 ocorrências. [Roteiro Playwright](geogenviewer/scripts/verify-v08.mjs) · [Resultados](docs/v08/evidence/browser.json)

## Resultado

- `npm test` passou com 55 testes. `npm run lint`, `npm run typecheck` e `npm run build` passaram.
- `test:ui`, `test:v05`, `test:v06` e `test:v07` passaram no build V0.8. `test:v08` também passou, com os três conjuntos de escala, sem erros de página e com zero violações axe nos seis estados auditados.
- A comparação de PNGs confirmou a inclusão de callouts. A auditoria confirmou A4 paisagem em 1.634 × 1.155 px e A3 retrato em 1.485 × 2.100 px. O manual da fixture mostrou as quatro etapas e foi impresso em PDF no Chrome.
- Ao voltar ao estilo de miniatura já renderizado, o contador de codificações ficou em 9. Escolher o estilo técnico elevou o contador a 10. As seis resoluções mantiveram um contexto WebGL e zero overflow horizontal.
- A regeneração de `catalog-lab` produziu os mesmos arquivos rastreados no Git.

## Capturas reais

| Estado | Captura |
| --- | --- |
| Disposição completa, por grupo e por tipo | [Completa](docs/v08/evidence/knolling-completo.png) · [Categoria](docs/v08/evidence/knolling-categoria.png) · [Tipos](docs/v08/evidence/knolling-tipos.png) |
| Catálogo | [Cartões](docs/v08/evidence/catalogo-cards.png) · [Tabela](docs/v08/evidence/catalogo-tabela.png) |
| Identificação e fichas | [Callouts](docs/v08/evidence/callouts.png) · [Peça](docs/v08/evidence/ficha-individual.png) · [Montagem](docs/v08/evidence/ficha-montagem.png) · [Comparação](docs/v08/evidence/comparacao-pecas.png) |
| 1920 × 1080 | [Knolling](docs/v08/evidence/knolling-1920x1080.png) |
| 1440 × 900 | [Knolling](docs/v08/evidence/knolling-1440x900.png) |
| 1280 × 800 | [Knolling](docs/v08/evidence/knolling-1280x800.png) |
| 1024 × 768 | [Knolling](docs/v08/evidence/knolling-1024x768.png) · [Catálogo](docs/v08/evidence/catalogo-1024x768.png) |
| 768 × 1024 | [Knolling](docs/v08/evidence/knolling-768x1024.png) · [Catálogo](docs/v08/evidence/catalogo-768x1024.png) |
| 390 × 844 | [Knolling](docs/v08/evidence/knolling-390x844.png) · [Catálogo](docs/v08/evidence/catalogo-390x844.png) |

- [Exemplos exportados de knolling, catálogo, fichas e montagem](docs/v08/examples/) · [Manual imprimível em PDF](docs/v08/examples/manual-imprimivel.pdf).
- A auditoria touch foi emulada. As homologações com hardware tablet, Rhino 8 e o modelo autorizado da Casa Gerassi seguem pendentes.
