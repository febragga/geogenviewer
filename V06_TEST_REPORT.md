# GeoGenViewer V0.6 — relatório de testes

## Resultado

| Comando na pasta `geogenviewer` | Resultado |
|---|---|
| `npm run lint` e `npm run typecheck` | Aprovados |
| `npm test` | 33 aprovados, incluindo 23 testes anteriores |
| `npm run build` | Build de produção Next.js 16.4.6 aprovado |
| `npm run test:ui` e `npm run test:v05` | Regressões aprovadas, zero violações axe nos estados auditados |
| `npm run test:v06` | Inspeção E2E e axe em Chrome headless aprovada |

Foram verificados eixos CAD, inversão, combinação, retorno ao estado original, picking atrás de superfícies cortadas, contorno de malha aberta, preenchimento de furos e cavidades, compósitos, coordenadas de origem, unidades, poses temporárias, instâncias, tolerância visual de snap e validação da identidade de inspeção.

O Playwright mediu o lado de 100 mm por clique e toque emulado. Também exercitou cancelamento, manipulador, quatro regiões com cortes separados e comparação dos pixels nas regiões, Named Views antigas e novas, captura branca e transparente, a inclusão de cotas no PNG, metadados da captura, importação válida e rejeição de estrutura ou revisão incompatível. A regressão cobre pavilhão, GLB-only, manifesto, filtros, apresentação, explosão, montagem e modo limpo.

As capturas verificadas mostram um Canvas com WebGL ativo, sem overflow nas seis janelas. A auditoria axe em cortes, medição e captura não encontrou violações. A medição de folga de 0,13 mm é verificada por teste da geometria sintética e das âncoras demonstrativas. O ensaio físico em tablet e a homologação com Rhino 8 ainda estão pendentes.

## Capturas do navegador

| Janela | Evidências |
|---|---|
| 1920 × 1080 | [Inspeção](geogenviewer/test-results/v06/1920-inspection.png) |
| 1440 × 900 | [Controles de corte](geogenviewer/test-results/v06/1440-section-controls.png) · [Corte preenchido](geogenviewer/test-results/v06/1440-filled-section.png) · [Cortes independentes](geogenviewer/test-results/v06/1440-quad-independent.png) · [Cota de 100 mm](geogenviewer/test-results/v06/1440-measurement.png) · [Explosão com corte](geogenviewer/test-results/v06/1440-exploded-cut.png) · [Montagem com corte](geogenviewer/test-results/v06/1440-assembly-cut.png) |
| 1280 × 800 | [Inspeção](geogenviewer/test-results/v06/1280-inspection.png) |
| 1024 × 768 | [Tablet landscape](geogenviewer/test-results/v06/1024-touch-section.png) |
| 768 × 1024 | [Tablet portrait](geogenviewer/test-results/v06/768-touch-section.png) |
| 390 × 844 | [Controles touch](geogenviewer/test-results/v06/390-touch-section.png) · [Medição touch](geogenviewer/test-results/v06/390-touch-measurement.png) |

## Documentação gerada pela aplicação

- [PNG técnico branco](geogenviewer/test-results/v06/technical-white.png) e [PNG transparente](geogenviewer/test-results/v06/technical-transparent.png)
- [Metadados da captura](geogenviewer/test-results/v06/technical-snapshot.json) e [JSON de inspeção](geogenviewer/test-results/v06/inspection-export.json)
- [Registro automatizado](geogenviewer/test-results/v06/results.json)

Os artefatos em `test-results/` são locais e reproduzíveis com `npm run test:v06` após o build.
