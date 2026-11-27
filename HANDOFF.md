
# GeoGenViewer — handoff

- **Versão da aplicação:** `0.9.12`
- **Data:** 27/11/2026
- **Candidata:** Sprint C em `fix/v0.9.12-sprint-c`, sobre `dc6d2e2` (Sprint B) e `0588b6d` (Sprint A).
- **Responsável pelas decisões:** Fernando Braga

## Estado

A Sprint C audita a candidata V0.9.12 e corrige o descarte e a escala do GTAO, a exposição de Clay no PNG, as cores e espessura no Mono, a ordenação de Dither e o esquema nativo do Blueprint. [Auditoria e matriz](SPRINT_C_RELEASE_AUDIT.md) · [Desempenho](SPRINT_C_PERFORMANCE_REPORT.md)

A Sprint B conclui os quatro modos gráficos no visualizador (`Mono 2.0`, `Blueprint` com tema dedicado da UI, `Dither` em shader Bayer `4×4`/`8×8` e `Clay` com iluminação de estúdio e `GTAOPass` sensível à escala), além do refinamento do menu **Exibição**, do **Resumo** tabular agrupado, dos cabeçalhos/callouts do **Knolling** e do viewport offscreen de exportação PNG. [Relatório Sprint B](SPRINT_B_DISPLAY_MODES_REPORT.md) · [Handoff dos modos gráficos](DISPLAY_MODES_HANDOFF.md)

A Sprint A centraliza rótulos de componentes, acrescenta o Resumo à viewport e amplia a orientação e os títulos do Knolling, mantendo a migração de vistas legadas (`clay` → `mono`) e o contrato CAD JSON `1.0.0`.

A V0.9.11 remove os links públicos do GitHub da navegação da Home e da aba **Sobre** nas Configurações. A referência técnica `GEOGEN_REPO_URL` continua disponível e o contrato CAD JSON segue na versão `1.0.0`.

A V0.9.1 preserva a home, o cubo SVG e o sistema visual anterior. Corrige domínio, persistência, importação, cancelamento e seleção/picking GPU. Mantém um Canvas por sessão de visualização e o contrato de manifesto CAD 1.0.0.

- [Auditoria](V091_ENGINEERING_AUDIT.md) · [Arquitetura](V091_ARCHITECTURE_REVIEW.md) · [Regressão e resultado do build](V091_REGRESSION_REPORT.md) · [Desempenho](V091_PERFORMANCE_REPORT.md)
- [Limites e backlog](KNOWN_ISSUES.md) · [Checklist de homologação](V1_RELEASE_CANDIDATE_CHECKLIST.md)
- [Entrega do Gemini](V09_IMPLEMENTATION_REPORT.md) · [Guia da V0.9](V09_USER_GUIDE.md)

## Verificação local

Na Sprint C, `lint`, `typecheck`, `test` (79 testes) e `build` passaram. A matriz gráfica rodou em SwiftShader e Intel/D3D11, com exportação em três resoluções e contagens de recursos estáveis após troca repetida de modos. As suítes Playwright históricas e o smoke específico da Sprint B também passaram. [Matriz](SPRINT_C_RELEASE_AUDIT.md) · [Perfil de desempenho](SPRINT_C_PERFORMANCE_REPORT.md)

Na Sprint B, passaram `lint`, `typecheck`, `test` (`79/79` testes unitários), `build`, `verify-sprint-b.mjs` (capturas comparativas em `test-results/sprint-b/`, PNG 1920 px opaco/transparente, Axe WCAG A/AA sem violações) e todas as suítes Playwright existentes (`test:ui`, `test:v05` a `test:v0912`). [Relatório Sprint B](SPRINT_B_DISPLAY_MODES_REPORT.md)

Na Sprint A, `lint`, `typecheck`, `test` (79 testes) e `build` passaram. O smoke test direcionado verifica importação, escopos do Resumo, preferência gráfica, exportação PNG e renomeação de etapas. [Regressões e limitações da V0.9.12](V0912_REGRESSION_REPORT.md)

Na V0.9.11, `lint`, `typecheck`, `test` (73 testes) e `build` passaram. O smoke test no Chrome confirmou a ausência dos links, a navegação da Home em quatro resoluções e os dados restantes da aba **Sobre** em desktop. Os tamanhos de tablet e celular foram emulados.

A regressão da V0.9.1 cobre os oito workspaces em sete suítes. Os perfis de navegador registram SwiftShader e GPU Intel/D3D11, com 2 draw calls em 10.000 ocorrências repetidas e um contexto na vista única. [Testes](V091_REGRESSION_REPORT.md) · [Amostras](V091_PERFORMANCE_REPORT.md)

## Continuidade

O escopo permanece congelado até a homologação. O responsável tem o roteiro de validação com o GeoGenExporter no Rhino 8, a maquete autorizada da Casa Gerassi e tablet e smartphone físicos. [Checklist](V1_RELEASE_CANDIDATE_CHECKLIST.md)
