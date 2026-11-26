# GeoGenViewer — handoff

- **Versão consolidada:** `0.8.0` (`v0.8.0`)
- **Data:** 26/11/2026
- **Branch principal:** `main` (consolidada a partir de `feat/v0.8-knolling-component-catalog`, commits `1d5a3b5`, `15918ce` e `3cda0db`, base `93f8f74` / `v0.7.0`)
- **Responsável pelas decisões:** Fernando Braga

## Estado consolidado (V0.1–V0.8)

- **V0.1–V0.4:** Visualizador GLB local, seleção semântica, árvore virtualizada, manifesto CAD `1.0.0` (SHA-256), vista explodida (`radial`, `axial` CAD, `directional`, `hierarchical`) e linhas de referência.
- **V0.5–V0.6:** Câmeras perspectiva/ortográfica, cubo de orientação, até 4 viewports em contexto WebGL único, filtros, Named Views, apresentação, timeline determinística, clipping em 3 eixos, snapping, medições e schema `inspection-v1.schema.json`.
- **V0.7:** Workspaces **Comparar** e **Quantitativos** (`geogenviewer/src/lib/geogen/revisions/`): alinhamento de duas revisões, correspondência persistente com resolução manual de ambiguidades, diff em repouso, análise de fabricação com proveniência/cobertura e exportações CSV/JSON/PNG.
- **V0.8:** Domínios de **Knolling**, **Catálogo**, **Callouts** e **Documentação** (`geogenviewer/src/lib/geogen/documentation/`):
  - Knolling com 5 modos, planos XY/XZ/YZ, posições fixáveis com detecção de conflitos e restauração integral da pose ao sair.
  - Catálogo com busca, filtros, agrupamento por tipo e variante, miniaturas em cache no renderer existente e seleção sincronizada com visualizador, quantitativos e comparação.
  - Callouts vinculados às ocorrências, listas de peças, fichas A4/A3 e manual imprimível baseado em etapas autoradas (ilustrando até 20 etapas; exporta sequência completa em JSON), além de exportações PNG, CSV e JSON com compatibilidade preservada ao manifesto CAD `1.0.0`.
  - Laboratório sintético `geogenviewer/public/demos/catalog-lab/` com duas revisões sintéticas.

## Documentação e referências V0.8

- [Relatório de implementação](V08_IMPLEMENTATION_REPORT.md) · [Guia de uso](V08_USER_GUIDE.md) · [Testes e evidências](V08_TEST_REPORT.md) · [Desempenho](V08_PERFORMANCE_REPORT.md) · [Capturas](docs/v08/evidence/) · [Exemplos exportados](docs/v08/examples/) · [Manual em PDF](docs/v08/examples/manual-imprimivel.pdf)

## Verificações

- `npm run lint`, `npm run typecheck`, `npm test` (55 testes unitários), `npm run build` e cinco suítes Playwright (`test:ui`, `test:v05`, `test:v06`, `test:v07`, `test:v08`) em `geogenviewer/`.
- A auditoria V0.8 verificou 6 resoluções sem overflow, um contexto WebGL e 0 violações `axe` nos 6 estados avaliados; confirmou cache de miniaturas, dimensões PNG A4/A3 e geração de PDF pelo navegador.
- Benchmark V0.8: com 10.000 ocorrências sintéticas, disposição levou `30,9 ms` em CPU; no navegador, carga e disposição levaram `1,27 s` com `10.001` draw calls.

## Limitações, adiamentos e próximo marco (V0.9)

- A orientação automática usa heurística de malha; o manual ilustra até 20 etapas (JSON exporta tudo); motor próprio de PDF e checklist de produção ficaram adiados.
- A atualização do cabeçalho da home e o refinamento de UI ficaram reservados para a V0.9, junto com a investigação do custo de draw calls (`10.001`), atualização de poses e projeção de rótulos.
- Seguem pendentes: homologação em **tablet físico**, execução do `GeoGenExporter` no **Rhino 8** real e validação com **modelo autorizado da Casa Gerassi** (nenhum arquivo privado versionado).
