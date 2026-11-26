# V0.8 — auditoria de knolling e catálogo

A árvore estava limpa em `93f8f74`, tag `v0.7.0`, com `main` e `origin/main` no mesmo commit. `fa4f9a1` é ancestral da consolidação. A branch `feat/v0.8-knolling-component-catalog` usa a revisão consolidada como base.

## Linha de base reproduzida

Os 45 testes da V0.7, ESLint, TypeScript, build e as quatro suítes Playwright passaram antes da implementação. Com 10.000 peças por revisão, a correspondência levava 6,481 ms e o diff 113,208 ms em Node. A suíte do navegador também executou os três tamanhos de fixture e verificou um contexto WebGL em seis resoluções. [Resultados CPU](docs/v08/evidence/baseline-v07-cpu.json) · [Resultados do navegador](docs/v08/evidence/baseline-v07-browser.json)

## Reutilização

| Componente auditado | Aplicação na V0.8 |
| --- | --- |
| Importação, SceneGraph e identidade | O snapshot de revisão fornece ocorrências, partes e matrizes mundiais de repouso |
| Explosão e montagem | Os modos alternam poses temporárias. Knolling tem controlador próprio e restaura as matrizes antes dos demais modos |
| Section Engine e medições | Captura ativa reutiliza recorte, âncoras, escala gráfica e composição da V0.6 |
| Correspondência, quantitativos e fabricação | Catálogo usa os mesmos resultados e métodos, associados à revisão corrente |
| Câmeras, Named Views e captura | Um rig e um Canvas. O mesmo renderer cria imagens de catálogo em alvos offscreen |
| GPU e recursos | Cenas temporárias compartilham geometrias e materiais importados. Encerramento limpa alvos, fila, variantes e URLs |

Uma viewport separada para cada card aumentaria o número de contextos e duplicaria recursos. As projeções da V0.8 usam o renderer já criado, uma fila serial e imagens raster locais. Um controlador que somasse offsets de explode, montagem e knolling precisaria resolver a ordem dos movimentos. Os estados atuais escolhem um modo de apresentação por vez.

A documentação do CraftBot descreve peças organizadas em prateleiras e transição controlada por slider. A V0.8 tomou isso como referência de interação e implementou a disposição com as ocorrências GLB/CAD e as convenções do GeoGenViewer. A auditoria anterior registra as fronteiras de licença e procedência. [Documentação pública do CraftBot](https://github.com/lukapiskorec/craftbot#web-viewer) · [Auditoria local](CRAFTBOT_ANALYSIS.md)
