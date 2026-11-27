# GeoGenViewer

Visualizador web independente (*local-first*) de modelos arquitetônicos e de geometria computacional, com foco em inspeção por componentes, vista explodida, sequenciamento construtivo, organização personalizada, planos de corte, medições e documentação técnica.

- **Aplicação Next.js (Root Directory no Vercel):** [`geogenviewer/`](geogenviewer/) — rotas `/` e `/viewer`
- **Contrato de interoperabilidade Rhino 8 (`v1.0.0`):** [`exporter-contract/`](exporter-contract/)
- **Versão atual** `0.9.12`, candidata à homologação. [Auditoria](SPRINT_C_RELEASE_AUDIT.md) · [Desempenho](SPRINT_C_PERFORMANCE_REPORT.md) · [Checklist V1.0](V1_RELEASE_CANDIDATE_CHECKLIST.md)

## Funcionalidades implementadas

- **V0.1:** Visualizador GLB local sem upload de arquivos, cubo de referência 100 mm, controles de órbita/pan/zoom/enquadramento/reset e temas claro/escuro.
- **V0.2–V0.3:** Seleção individual e múltipla, árvore pesquisável (`Componentes`, `Camadas`, `Grupos`), visibilidade/isolamento, validação GLB + manifesto JSON `1.0.0` (SHA-256 e JSON Schema 2020-12).
- **V0.4:** Vista explodida (`radial`, `axial` CAD, `directional`, `hierarchical`), escopo/granularidade e linhas de referência em lote.
- **V0.5:** Perspectiva/ortográfica, múltiplas câmeras até 4 viewports em contexto WebGL único, filtros combináveis, Named Views, modo apresentação e timeline/editor de montagem.
- **V0.6:** Workspace Inspecionar, clipping em 3 eixos por região, picking/snapping com recorte, medições ancoradas, captura PNG técnica e schema independente [`inspection-v1.schema.json`](geogenviewer/schemas/inspection-v1.schema.json).
- **V0.7:** Dois GLBs no workspace Comparar, alinhamento, correspondência por identidade e revisão manual, diff em pose de repouso, quantitativos por ocorrência e análise de fabricação com proveniência e cobertura. Exportações locais CSV, JSON e PNG. [Guia V0.7](V07_USER_GUIDE.md) · [Relatório](V07_IMPLEMENTATION_REPORT.md).
- **V0.8:** Knolling (cinco modos, planos XY/XZ/YZ, fixações e retorno à pose), catálogo com miniaturas em cache e seleção sincronizada, callouts vinculados às ocorrências, listas de peças, fichas A4/A3 e manual imprimível baseado nas etapas autoradas. [Guia V0.8](V08_USER_GUIDE.md) · [Relatório](V08_IMPLEMENTATION_REPORT.md).
- **V0.9:** Identidade visual `#3B82F6` e Home Launchpad com showcase e projetos recentes, Cubo de Navegação 3D sólido chanfrado com rotação 90°, workspaces em 4 famílias, **Sistema Independente de Camadas e Grupos do Usuário** ([`organization-v1.schema.json`](geogenviewer/schemas/organization-v1.schema.json)) com Undo/Redo e Menu de Contexto, diálogo de **Configurações**, `InstancedMesh` GPU batching (`10.001` → `2` draw calls em 10.000 peças) e cancelamento de carregamento (`AbortController`).

- **V0.9.1:** Validação de identidade, organização por revisão, máscaras independentes de grupos, picking de instâncias e recuperação de carregamento/WebGL. O manual explicita a cobertura das ilustrações. [Implementação](V091_IMPLEMENTATION_REPORT.md)

- **V0.9.12:** rótulos por PartID, Resumo, orientação e nomenclatura de Knolling, modos Mono, Blueprint, Dither e Clay. [Changelog](CHANGELOG.md)

## Homologações pendentes

- Execução e homologação do `GeoGenExporter` em ambiente real do Rhino 8.
- Testes de usabilidade em tablet físico.
- Validação com geometria autorizada da Casa Gerassi.

## Executar e verificar localmente

Consulte [`geogenviewer/README.md`](geogenviewer/README.md) para os scripts `lint`, `typecheck`, `test`, `build` e suítes Playwright, incluindo `test:sprint-c` para a candidata.
