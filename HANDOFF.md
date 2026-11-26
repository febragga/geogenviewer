# GeoGenViewer — handoff

- **Data** 25/11/2026
- **Branch** `feat/v0.6-spatial-inspection`
- **Base** `42f0b89` em `feat/v0.5-viewer-experience-assembly`
- **Responsável** Fernando Braga

## Estado

A V0.6 acrescenta Inspecionar, planos CAD por viewport, seleção e snap compatíveis com clipping, medições ancoradas e captura técnica. O modelo mantém um Canvas e um contexto WebGL. A inspeção persiste separadamente em `inspection.json` com schema 1.0.0 próprio. O contrato CAD e as fixtures anteriores permanecem compatíveis.

O laboratório sintético contém 17 componentes, cubo de 100 mm, uma folga geométrica de 0,13 mm e origem CAD distante. O gerador pode ser executado com `npm run fixture:inspection`. Abra `/viewer?demo=inspecao` para testar os fluxos.

## Verificações

- Lint, typecheck, 33 testes, build de produção e três suítes Playwright.
- Seis resoluções, medições por clique e toque emulado, axe e exportações técnicas.
- Baseline V0.5 reproduzido e benchmark CPU de inspeção com 100, 1.000 e 10.000 componentes.
- [Relatório de testes e capturas](V06_TEST_REPORT.md) · [Desempenho](V06_PERFORMANCE_REPORT.md) · [Guia](V06_USER_GUIDE.md)

## Próximo marco

Manter V0.7 focada em comparação de revisões e quantitativos com proveniência. Validar o fluxo em tablet físico e o GeoGenExporter no Rhino 8 quando disponíveis. A inspeção com geometria autorizada da Casa Gerassi depende do responsável.
