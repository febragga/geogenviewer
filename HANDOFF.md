# GeoGenViewer — handoff

- **Data** 25/11/2026
- **Branch** `feat/v0.5-viewer-experience-assembly`
- **Base** `c20be20` na branch `feat/v0.4-exploded-view`
- **Responsável** Fernando Braga

## Estado

A V0.5 integra a câmera com quatro layouts, vistas locais, filtros, apresentação, explosão e montagem. O viewport usa uma cena R3F em um contexto WebGL. OrbitControls e raycasting usam a câmera da região ativa. Seleção, visibilidade e inspeção mantêm os IDs importados.

O pavilhão sintético tem 18 componentes e seis passos autorados. A reprodução e a edição preservam os dados de origem. O download do manifesto mantém `geometry.file` e o hash do GLB. O pacote público de referência em `exporter-contract/` continua aplicável.

## Verificações

- Lint, typecheck, 23 testes automatizados e build de produção.
- Playwright da V0.4 e suíte V0.5 com seis dimensões de janela, auditorias axe e toque emulado.
- Benchmark CPU da montagem com 100, 1.000 e 10.000 componentes e comparação WebGL de uma e quatro vistas.
- [Resultados e capturas](V05_TEST_REPORT.md)
- [Desempenho](V05_PERFORMANCE_REPORT.md)
- [Guia de uso](V05_USER_GUIDE.md)

## Próximo marco

Validar gestos e legibilidade em um tablet físico e abrir um pacote autorizado exportado pelo GeoGenExporter no Rhino 8 quando ele estiver homologado. Na V0.6, implementar clipping integrado ao picking e aos PNGs, medição sobre malha com proveniência e documentação técnica. Os dados da Casa Gerassi dependem de autorização do responsável.
