
# GeoGenViewer V0.9.1 — acessibilidade

O tema claro e escuro usa a mesma preferência na home e no viewer. O teste da aba de camadas reproduziu contraste insuficiente no botão pressionado. O botão passou a usar `--gg-accent` e `--gg-accent-ink` e o cenário claro foi aprovado na nova execução. Os elementos de marca e a hierarquia de navegação permanecem da V0.9.0. O Navigation Cube mantém estado de foco durante a reprojeção e transfere o foco à sua ação de vista inicial quando a superfície deixa de ser visível. A vista continua acionável por botões HTML. O navegador anuncia a perda da viewport, a falha de importação e a indisponibilidade de persistência.

A suíte de UI verifica desktop, tablet em emulação, smartphone em emulação, navegabilidade por teclado e contraste com axe. A regressão da V0.9 cobre resoluções de 1920×1080, 1440×900, 1280×800, 1024×768, 768×1024 e 390×844. O roteiro V0.9.1 usa tema claro e estima a acessibilidade dos estados gerados com dados sintéticos. A cobertura e as capturas são listadas no relatório de regressão.

A alternância suspende a transição de cores durante a mudança do esquema e volta a habilitá-la em dois frames. Essa pausa corrigiu estados intermediários de baixo contraste detectados na home durante a mudança para o tema claro.

A auditoria empregou o guia `ui-ux-pro-max` para foco e mensagens de erro e as suítes reais do Chromium com axe WCAG 2.1. Testes de acessibilidade com leitor de tela, pinça e gestos prolongados em hardware físico permanecem na homologação. [Resultados](V091_REGRESSION_REPORT.md) · [Evidências](docs/v091/evidence/)
