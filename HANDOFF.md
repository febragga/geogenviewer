# GeoGenViewer — handoff

- **Versão consolidada:** `0.6.0` (`v0.6.0`)
- **Data:** 25/11/2026
- **Branch principal:** `main` (consolidada a partir de `feat/v0.6-spatial-inspection`, contendo o histórico linear completo de `feat/viewer-bootstrap` → `feat/v0.2-v0.3-import-pipeline` → `feat/v0.4-exploded-view` → `feat/v0.5-viewer-experience-assembly` → `feat/v0.6-spatial-inspection`)
- **Responsável pelas decisões:** Fernando Braga

## Estado consolidado (V0.1–V0.6)

- **V0.1:** Visualizador WebGL local em `/viewer` com importação GLB autocontida, cubo de referência 100 mm, órbita/pan/zoom/enquadramento/reset e UI responsiva claro/escuro.
- **V0.2–V0.3:** Seleção semântica individual e múltipla, destaque não destrutivo, árvore virtualizada (`Componentes`, `Camadas`, `Grupos`), visibilidade/isolamento, validação estrita GLB + JSON manifesto `1.0.0` com SHA-256 e contrato externo `exporter-contract/`.
- **V0.4:** Motor de vista explodida (`radial`, `axial` na convenção CAD, `directional`, `hierarchical`), escopos e granularidades distintos, linhas de referência em lote único e pavilhão sintético.
- **V0.5:** Workspaces (`Explorar`, `Explodir`, `Montagem`), câmeras perspectiva/ortográfica, cubo de orientação, até 4 viewports em um único contexto WebGL, filtros combináveis, Named Views, apresentação, PNG e timeline/editor de montagem determinística.
- **V0.6:** Workspace Inspecionar, 3 planos de corte CAD reversíveis por região e cap condicional, picking e snapping com recorte, medições ponto a ponto/delta/coordenadas, captura técnica PNG e persistência isolada em `inspection-v1.schema.json`.

## Homologações pendentes (não concluídas na `v0.6.0`)

- Validação do `GeoGenExporter` em ambiente real do **Rhino 8**.
- Validação de usabilidade e toque em **tablet físico**.
- Inspeção com **modelo real autorizado da Casa Gerassi** (nenhum arquivo privado da IC versionado).

## Verificações da release `v0.6.0`

- `npm run lint`, `npm run typecheck`, `npm test` (33 testes), `npm run build` e as suítes Playwright `test:ui`, `test:v05` e `test:v06` em `geogenviewer/`.
- [Relatório de testes e capturas V0.6](V06_TEST_REPORT.md) · [Desempenho V0.6](V06_PERFORMANCE_REPORT.md) · [Guia V0.6](V06_USER_GUIDE.md)

## Próximo marco (V0.7)

Comparação de revisões com correspondência de IDs e quantitativos com proveniência, além das homologações pendentes acima quando disponíveis.
