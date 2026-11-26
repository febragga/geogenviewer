# GeoGenViewer — handoff

- **Versão consolidada:** `0.7.0` (`v0.7.0`)
- **Data:** 26/11/2026
- **Branch principal:** `main` (consolidada a partir de `feat/v0.7-revision-fabrication-analytics`, commits `3cfb1c9`, `5666059`, `b2a06a2` e `fa4f9a1`, base `4008b9f` / `v0.6.0`)
- **Responsável pelas decisões:** Fernando Braga

## Estado consolidado (V0.1–V0.7)

- **V0.1:** Visualizador WebGL local em `/viewer` com importação GLB autocontida, cubo de referência 100 mm, órbita/pan/zoom/enquadramento/reset e UI responsiva claro/escuro.
- **V0.2–V0.3:** Seleção semântica individual e múltipla, árvore virtualizada (`Componentes`, `Camadas`, `Grupos`), visibilidade/isolamento, validação estrita GLB + JSON manifesto `1.0.0` com SHA-256 e contrato externo `exporter-contract/`.
- **V0.4:** Motor de vista explodida (`radial`, `axial` na convenção CAD, `directional`, `hierarchical`), escopos e granularidades distintos, linhas de referência em lote único e pavilhão sintético.
- **V0.5:** Workspaces (`Explorar`, `Explodir`, `Montagem`), câmeras perspectiva/ortográfica, cubo de orientação, até 4 viewports em um único contexto WebGL, filtros combináveis, Named Views, apresentação, PNG e timeline/editor de montagem determinística.
- **V0.6:** Workspace Inspecionar, 3 planos de corte CAD reversíveis por região e cap condicional, picking e snapping com recorte, medições ponto a ponto/delta/coordenadas, captura técnica PNG e persistência isolada em `inspection-v1.schema.json`.
- **V0.7:** Workspaces **Comparar** e **Quantitativos** em contexto WebGL único (`geogenviewer/src/lib/geogen/revisions/`): carregamento simultâneo de duas revisões, alinhamento por origem CAD ou ajuste manual, correspondência por IDs persistentes com resolução manual de ambiguidades, inspeção lado a lado / sobreposição / alternância em pose de repouso (transformações, metadados e malha), contagem por ocorrência, biblioteca de materiais, massas separadas por método (teórica, medida, estimada e slicer), custos por moeda e método, exportações CSV/JSON/PNG com verificação de hash e laboratório sintético `geogenviewer/public/demos/revision-lab/`.

## Documentação e referências V0.7

- [Guia de uso](V07_USER_GUIDE.md) · [Relatório de implementação e especificações](V07_IMPLEMENTATION_REPORT.md) · [Testes e capturas](V07_TEST_REPORT.md) · [Benchmarks](V07_PERFORMANCE_REPORT.md) · [Exemplos CSV e JSON](docs/v07/examples)

## Verificações

- `npm run lint`, `npm run typecheck`, `npm test` (45 testes unitários), `npm run build` e quatro suítes Playwright (`test:ui`, `test:v05`, `test:v06`, `test:v07`) em `geogenviewer/`.
- A auditoria da V0.7 verificou seis resoluções com zero violações `axe` nos oito estados avaliados. Com 10.000 peças por revisão, a correspondência levou 6,7 ms e o diff geométrico/semântico 124,6 ms em Node; no Chrome + SwiftShader, o fluxo completo levou 4,08 s e a vista lado a lado registrou 20.000 draw calls (`docs/v07/evidence/`).

## Limitações e homologações pendentes

- A comparação geométrica é aproximada e utiliza malhas tesselladas do GLB.
- Seguem pendentes: homologação em **tablet físico**, execução do `GeoGenExporter` no **Rhino 8** real e validação com **modelo autorizado da Casa Gerassi** (nenhum arquivo privado versionado).
## V0.8 — branch local de feature · 26/11/2026

- Base `93f8f74`, tag `v0.7.0`. Branch `feat/v0.8-knolling-component-catalog`.
- Domínios de knolling, catálogo, callouts e documentação em `geogenviewer/src/lib/geogen/documentation/`. O laboratório `catalog-lab` tem duas revisões sintéticas.
- Os exports guardam configurações e referências no schema auxiliar V0.8. O catálogo consome quantitativos e fabricação da V0.7 e distingue revisão de ocorrência.
- [Implementação](V08_IMPLEMENTATION_REPORT.md) · [Testes e evidências](V08_TEST_REPORT.md) · [Desempenho](V08_PERFORMANCE_REPORT.md) · [Guia](V08_USER_GUIDE.md).
- Verificação local concluída com 55 testes unitários, lint, TypeScript, build e cinco suítes Playwright. A auditoria V0.8 passou nas seis resoluções com um contexto WebGL e zero violações axe nos seis estados. Exemplos e dados brutos ficam em `docs/v08/`.
- A V0.9 concentra desempenho, robustez, acessibilidade e refinamento da interface, incluindo cabeçalho da home e cubo de navegação.
