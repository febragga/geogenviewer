# GeoGenViewer

Visualizador web independente (*local-first*) de modelos arquitetônicos e de geometria computacional, com foco em inspeção por componentes, vista explodida, sequenciamento construtivo, organização personalizada, planos de corte, medições e documentação técnica.

- **Aplicação Next.js (Root Directory no Vercel):** [`geogenviewer/`](geogenviewer/) — rotas `/` e `/viewer`
- **Contrato de interoperabilidade Rhino 8 (`v1.0.0`):** [`exporter-contract/`](exporter-contract/)
- **Versão consolidada atual:** `0.9.0` (`feat/v0.9-product-design-performance` / alvo `v0.9.0`) — [Guia V0.9](V09_USER_GUIDE.md) · [Relatório V0.9](V09_IMPLEMENTATION_REPORT.md) · [Testes V0.9](V09_TEST_REPORT.md) · [Desempenho V0.9](V09_PERFORMANCE_REPORT.md) · [Organização do Usuário](V09_USER_ORGANIZATION_SPEC.md) · [Cubo 3D](V09_NAVIGATION_CUBE_SPEC.md) · [Evidências](docs/v09/evidence/after/)

## Funcionalidades implementadas

- **V0.1:** Visualizador GLB local sem upload de arquivos, cubo de referência 100 mm, controles de órbita/pan/zoom/enquadramento/reset e temas claro/escuro.
- **V0.2–V0.3:** Seleção individual e múltipla, árvore pesquisável (`Componentes`, `Camadas`, `Grupos`), visibilidade/isolamento, validação GLB + manifesto JSON `1.0.0` (SHA-256 e JSON Schema 2020-12).
- **V0.4:** Vista explodida (`radial`, `axial` CAD, `directional`, `hierarchical`), escopo/granularidade e linhas de referência em lote.
- **V0.5:** Perspectiva/ortográfica, múltiplas câmeras até 4 viewports em contexto WebGL único, filtros combináveis, Named Views, modo apresentação e timeline/editor de montagem.
- **V0.6:** Workspace Inspecionar, clipping em 3 eixos por região, picking/snapping com recorte, medições ancoradas, captura PNG técnica e schema independente [`inspection-v1.schema.json`](geogenviewer/schemas/inspection-v1.schema.json).
- **V0.7:** Dois GLBs no workspace Comparar, alinhamento, correspondência por identidade e revisão manual, diff em pose de repouso, quantitativos por ocorrência e análise de fabricação com proveniência e cobertura. Exportações locais CSV, JSON e PNG. [Guia V0.7](V07_USER_GUIDE.md) · [Relatório](V07_IMPLEMENTATION_REPORT.md).
- **V0.8:** Knolling (cinco modos, planos XY/XZ/YZ, fixações e retorno à pose), catálogo com miniaturas em cache e seleção sincronizada, callouts vinculados às ocorrências, listas de peças, fichas A4/A3 e manual imprimível baseado nas etapas autoradas. [Guia V0.8](V08_USER_GUIDE.md) · [Relatório](V08_IMPLEMENTATION_REPORT.md).
- **V0.9:** Identidade visual `#3B82F6` e Home Launchpad com showcase e projetos recentes, Cubo de Navegação 3D sólido chanfrado com rotação 90°, workspaces em 4 famílias, **Sistema Independente de Camadas e Grupos do Usuário** ([`organization-v1.schema.json`](geogenviewer/schemas/organization-v1.schema.json)) com Undo/Redo e Menu de Contexto, diálogo de **Configurações**, `InstancedMesh` GPU batching (`10.001` → `2` draw calls em 10.000 peças) e cancelamento de carregamento (`AbortController`).

## Homologações pendentes

- Execução e homologação do `GeoGenExporter` em ambiente real do Rhino 8.
- Testes de usabilidade em tablet físico.
- Validação com geometria autorizada da Casa Gerassi.

## Executar e verificar localmente

Consulte [`geogenviewer/README.md`](geogenviewer/README.md) para os scripts `lint`, `typecheck`, `test`, `build` e suítes Playwright (`test:ui`, `test:v05`, `test:v06`, `test:v07`, `test:v08` e `test:v09`).
