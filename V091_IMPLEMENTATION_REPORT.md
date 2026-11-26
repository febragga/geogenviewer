
# GeoGenViewer V0.9.1 — implementação

A sprint partiu de `e83ad98` e preservou a composição da home, a marca, o SVG do Navigation Cube, a tipografia e os tokens da V0.9.0. O trabalho concentrou-se na integridade dos dados, no renderer compartilhado e na recuperação de falhas.

| Arquivos | Responsabilidade |
| --- | --- |
| `geogenviewer/src/lib/geogen/importers/`, `validation/manifest.ts` | GLB autocontido, referências de cena, validação de dados e propriedade de ocorrência |
| `geogenviewer/src/lib/geogen/organization/` e `domain/visibility.ts` | Organização vinculada à revisão, profundidade e máscaras de visibilidade independentes |
| `geogenviewer/src/features/viewer/state/` | Persistência, undo/redo, revisão, cancelamento e escopo das viewports |
| `geogenviewer/src/features/viewer/scene/` | Instancing conservador, transformações, picking, ancoragem e descarte |
| `geogenviewer/src/features/viewer/components/` | Foco do cubo, recuperação em modo de apresentação e indicação do limite de ilustrações |
| `geogenviewer/app/layout.tsx` e `src/features/home/` | Metadados e persistência do tema e dos projetos recentes |
| `geogenviewer/tests/v091-engineering.test.mjs` e `geogenviewer/scripts/` | Regressões sintéticas, benchmark e smoke test de produção |

O build de produção referencia 8 scripts de cerca de 626 kB brutos na home e 10 scripts de aproximadamente 2,32 MB brutos no viewer. Sete arquivos são compartilhados. O volume adicional concentra-se na rota do viewer. Esses valores vêm do HTML estático e dos tamanhos de arquivo, antes de compressão e cache.

O favicon ICO tem variantes de 16, 32 e 48 px. O SVG mantém o triângulo apontado para cima em `#3B82F6`. O teste HTTP confirmou as referências de ícone e o manifest sem duplicação no head, além dos PNGs PWA e Open Graph. A referência do portfólio e os ativos do viewer foram inspecionados como arquivos independentes. [Favicon de referência](https://github.com/febragga/portfolio/blob/main/main-site/app/favicon.ico)

O lockfile atualiza apenas a versão da aplicação. A arquitetura preserva os schemas de intercâmbio, os bytes dos ícones e as fixtures. O atalho da organização local, os estados de erro e o foco do cubo fazem parte das mudanças de interface por correção funcional.

**CONDITIONAL RELEASE CANDIDATE.** A validação automatizada e a medição desktop cobrem a base técnica. O aceite da V1.0 depende dos pacotes reais do Rhino 8, da experiência em tablet físico e da demonstração com o modelo autorizado.

[Auditoria e prioridades](V091_ENGINEERING_AUDIT.md) · [Desempenho](V091_PERFORMANCE_REPORT.md) · [Regressão](V091_REGRESSION_REPORT.md) · [Acessibilidade](V091_ACCESSIBILITY_REPORT.md) · [Checklist V1.0](V1_RELEASE_CANDIDATE_CHECKLIST.md)
