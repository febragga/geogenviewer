# GeoGenViewer (`v0.6.0`)

Visualizador web independente (*local-first*) de modelos arquitetônicos e de geometria computacional, com foco em inspeção por componentes, vista explodida, sequenciamento construtivo, planos de corte e medições.

- **Aplicação Next.js (Root Directory no Vercel):** [`geogenviewer/`](geogenviewer/) — rotas `/` e `/viewer`
- **Contrato de interoperabilidade Rhino 8 (`v1.0.0`):** [`exporter-contract/`](exporter-contract/)
- **Versão consolidada atual:** `0.6.0` (`main`)

## Funcionalidades implementadas (V0.1–V0.6)

- **V0.1:** Visualizador GLB local sem upload de arquivos, cubo de referência 100 mm, controles de órbita/pan/zoom/enquadramento/reset e temas claro/escuro.
- **V0.2–V0.3:** Seleção individual e múltipla, árvore pesquisável (`Componentes`, `Camadas`, `Grupos`), visibilidade/isolamento, validação GLB + manifesto JSON `1.0.0` (SHA-256 e JSON Schema 2020-12).
- **V0.4:** Vista explodida (`radial`, `axial` CAD, `directional`, `hierarchical`), escopo/granularidade e linhas de referência em lote.
- **V0.5:** Perspectiva/ortográfica, cubo de orientação, até 4 viewports em contexto WebGL único, filtros combináveis, Named Views, modo apresentação e timeline/editor de montagem.
- **V0.6:** Workspace Inspecionar, clipping em 3 eixos por região, picking/snapping com recorte, medições ancoradas, captura PNG técnica e schema independente [`inspection-v1.schema.json`](geogenviewer/schemas/inspection-v1.schema.json).

## Homologações pendentes

- Execução e homologação do `GeoGenExporter` em ambiente real do Rhino 8.
- Testes de usabilidade em tablet físico.
- Validação com geometria autorizada da Casa Gerassi.

## Executar e verificar localmente

Consulte [`geogenviewer/README.md`](geogenviewer/README.md) para os scripts `lint`, `typecheck`, `test`, `build` e suítes Playwright (`test:ui`, `test:v05`, `test:v06`).
