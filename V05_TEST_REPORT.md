# GeoGenViewer V0.5 — relatório de testes

## Execução

| Verificação | Resultado |
|---|---|
| `npm --prefix geogenviewer run lint` | Aprovado |
| `npm --prefix geogenviewer run typecheck` | Aprovado |
| `npm --prefix geogenviewer test` | 23 de 23 aprovados, incluindo 13 cenários anteriores |
| `npm --prefix geogenviewer run build` | Next.js 16.4.6 gerou `/` e `/viewer` |
| `npm --prefix geogenviewer run test:ui` | Regressão visual V0.4 aprovada, com zero violações axe |
| `npm --prefix geogenviewer run test:v05` | Aprovação E2E e axe nas telas de quatro vistas, filtros, montagem e editor |

Os testes unitários e de integração cobrem as orientações e regiões de câmera, a altura de enquadramento, sincronização, persistência, busca, filtros, isolamento e restauração. A suíte de montagem cobre pausa, loop, tempo acumulado, scrubbing reversível, compósitos, ancestrais rotacionados e escalados, validação e reimportação do manifesto exportado com verificação SHA-256. Os testes de render confirmam a restauração dos materiais GLB e o cache de arestas para instâncias.

A suíte de navegador cobre o viewer sem manifesto, o par GLB/JSON, o fallback explícito, a explosão, a troca entre workspaces, os quatro layouts, seleção e visibilidade independentes, maximização, vistas após recarga, PNG de 1280 px com alpha, playback e download de manifesto. A automação touch usa Chrome emulado para verificar seleção, órbita, deslocamento e pinça. O teste também verifica Canvas único, ausência de perda de contexto e ajuste dos controles.

As primeiras rodadas encontraram um Canvas duplicado, botões sobrepostos, rótulos de cubo e contraste insuficiente em IDs de peças ocultas. A verificação final inclui esses estados. Os navegadores testados rodaram localmente, com WebGL via ANGLE/SwiftShader. A homologação no Rhino 8 e a validação em tablet físico seguem pendentes.

## Capturas reais

| Janela | Capturas |
|---|---|
| 1920 × 1080 | [Quatro vistas](geogenviewer/test-results/v05/1920-quad.png) · [Modo limpo](geogenviewer/test-results/v05/1920-clean.png) |
| 1440 × 900 | [Explorar](geogenviewer/test-results/v05/1440-explore.png) · [Quatro vistas](geogenviewer/test-results/v05/1440-quad.png) · [Filtros](geogenviewer/test-results/v05/1440-filters.png) · [Técnico](geogenviewer/test-results/v05/1440-technical.png) · [Montagem](geogenviewer/test-results/v05/1440-assembly.png) · [Editor](geogenviewer/test-results/v05/1440-editor.png) |
| 1280 × 800 | [Quatro vistas](geogenviewer/test-results/v05/1280-quad.png) |
| 1024 × 768 | [Montagem em tablet landscape](geogenviewer/test-results/v05/1024-assembly-touch.png) |
| 768 × 1024 | [Quatro vistas em tablet portrait](geogenviewer/test-results/v05/768-quad-touch.png) |
| 390 × 844 | [Explorar em smartphone](geogenviewer/test-results/v05/390-explore-touch.png) |

[PNG exportado](geogenviewer/test-results/v05/viewport-export.png) · [Dados da execução](geogenviewer/test-results/v05/results.json)

Os arquivos em `test-results/` são artefatos locais. O comando `test:v05` os gera a partir do build de produção.
