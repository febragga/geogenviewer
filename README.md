# GeoGenViewer

Visualizador web independente (*local-first*) de modelos arquitetônicos e de geometria computacional, com foco em inspeção por componentes, vista explodida, sequenciamento construtivo, planos de corte e medições.

- **Aplicação Next.js (Root Directory no Vercel):** [`geogenviewer/`](geogenviewer/) — rotas `/` e `/viewer`
- **Contrato de interoperabilidade Rhino 8 (`v1.0.0`):** [`exporter-contract/`](exporter-contract/)
- **Versão consolidada atual:** `0.8.0` (`main`, tag `v0.8.0`) — [Guia V0.8](V08_USER_GUIDE.md) · [Relatório](V08_IMPLEMENTATION_REPORT.md) · [Testes](V08_TEST_REPORT.md) · [Desempenho](V08_PERFORMANCE_REPORT.md) · [Capturas](docs/v08/evidence/) · [Exemplos](docs/v08/examples/) · [Manual em PDF](docs/v08/examples/manual-imprimivel.pdf)

## Funcionalidades implementadas

- **V0.1:** Visualizador GLB local sem upload de arquivos, cubo de referência 100 mm, controles de órbita/pan/zoom/enquadramento/reset e temas claro/escuro.
- **V0.2–V0.3:** Seleção individual e múltipla, árvore pesquisável (`Componentes`, `Camadas`, `Grupos`), visibilidade/isolamento, validação GLB + manifesto JSON `1.0.0` (SHA-256 e JSON Schema 2020-12).
- **V0.4:** Vista explodida (`radial`, `axial` CAD, `directional`, `hierarchical`), escopo/granularidade e linhas de referência em lote.
- **V0.5:** Perspectiva/ortográfica, cubo de orientação, até 4 viewports em contexto WebGL único, filtros combináveis, Named Views, modo apresentação e timeline/editor de montagem.
- **V0.6:** Workspace Inspecionar, clipping em 3 eixos por região, picking/snapping com recorte, medições ancoradas, captura PNG técnica e schema independente [`inspection-v1.schema.json`](geogenviewer/schemas/inspection-v1.schema.json).

- **V0.7:** Dois GLBs no workspace Comparar, alinhamento, correspondência por identidade e revisão manual, diff em pose de repouso, quantitativos por ocorrência e análise de fabricação com proveniência e cobertura. Exportações locais CSV, JSON e PNG. [Guia V0.7](V07_USER_GUIDE.md) · [Relatório](V07_IMPLEMENTATION_REPORT.md).

- **V0.8:** Knolling (cinco modos, planos XY/XZ/YZ, fixações e retorno à pose), catálogo com miniaturas em cache e seleção sincronizada, callouts vinculados às ocorrências, listas de peças, fichas A4/A3 e manual imprimível baseado nas etapas autoradas, com exportação PNG/CSV/JSON. [Guia V0.8](V08_USER_GUIDE.md) · [Relatório](V08_IMPLEMENTATION_REPORT.md) · [Testes](V08_TEST_REPORT.md).

## Homologações pendentes

- Execução e homologação do `GeoGenExporter` em ambiente real do Rhino 8.
- Testes de usabilidade em tablet físico.
- Validação com geometria autorizada da Casa Gerassi.

## Executar e verificar localmente

Consulte [`geogenviewer/README.md`](geogenviewer/README.md) para os scripts `lint`, `typecheck`, `test`, `build` e suítes Playwright (`test:ui`, `test:v05`, `test:v06`, `test:v07` e `test:v08`). O botão **Laboratório de catálogo** em `/viewer` carrega as revisões sintéticas da V0.8.
