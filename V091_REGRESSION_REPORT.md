
# GeoGenViewer V0.9.1 — regressão e smoke de produção

O ambiente usou Node 22.14.0 em Windows x64 e Chrome via Playwright. Os testes de navegador partiram de `next build` e `next start` local em loopback. Os perfis de GPU têm indicação própria do renderer. [Desempenho](V091_PERFORMANCE_REPORT.md)

| Verificação | Comando | Cobertura |
| --- | --- | --- |
| Lint e tipos | `npm run lint`, `npm run typecheck` | ESLint e TypeScript estrito |
| Domínio / integração Node | `npm test` | 73 casos, incluindo 11 novos. GLB inválido, aliases, organização, undo/redo, picking após mover uma peça além da esfera anterior, matriz explícita e 100 ciclos de restauração |
| Produção | `npm run build`, `npm run test:v091` | Rotas, ícones, GLB-only, exportação e restauração de organização, vínculo incompatível, importação inválida, cancelamento, WebGL e armazenamento indisponível |
| UI, acessibilidade e navegação | `npm run test:ui`, `npm run test:v09` | Home clara/escura, paleta, configurações, menu contextual, navegação, cubo, touch em emulação e resoluções |
| Câmeras e montagem CAD | `npm run test:v05`, `npm run test:v06` | Layouts, vistas nomeadas da V0.5, timeline, editor, planos, snaps, medidas e PNG |
| Comparação e quantitativos | `npm run test:v07` | Duas revisões, alinhamento, correspondência manual, clipping e exportações |
| Knolling, catálogo e fichas | `npm run test:v08` | Escopos, miniaturas e cache, callouts, PDF imprimível, A4/A3 e exportações. Perfil de 10.000 componentes com Quad e substituição |
| Dependências | `npm audit --json` | Consulta respondeu 0 vulnerabilidades |

## Roteiros E2E

- **A · GLB básico.** Quatro pilares selecionados pela árvore, grupo e camada personalizados, atribuição, exportação, desfazer, restauração, rejeição de hash incompatível, isolamento, knolling e catálogo.
- **B · Modelo CAD.** Verificações encadeadas pelas suites V0.5, V0.6, V0.8 e pelos testes do pacote sintético. Incluem SHA-256, propriedades, corte, medição, vistas, pose, montagem e fichas.
- **C · Protótipos.** V0.7 verifica comparação e quantitativos. A correspondência manual, o alinhamento, as seções de comparação e o download são exercitados no navegador. Casos de ambiguidade também são testados no domínio.
- **D · Estresse.** A V0.8 abre fixtures de 100, 1.000 e 10.000 ocorrências, executa knolling, filtro, seleção, miniatura, ficha e captura. O perfil adicional troca 10.000 ocorrências para Quad e substitui a cena pelo GLB básico, verificando que o canvas anterior foi removido.
- **E · Recuperação.** GLB truncado e manifesto explícito malformado preservam o modelo anterior. O cancelamento interrompe uma demonstração em voo. A recuperação de perda artificial de contexto recria o Canvas após a ação do usuário e mantém o modelo local. O teste bloqueia também `localStorage` e continua a edição em memória.

## Evidências

[Capturas e JSON da V0.9.1](docs/v091/evidence/) · [Capturas de referência da V0.9.0](docs/v09/evidence/after/) · [Acessibilidade](V091_ACCESSIBILITY_REPORT.md)

O teste em emulação cobre o layout e a interação programática. Rhino 8, dispositivos físicos, arquivos reais autorizados e apresentação de montagem ainda dependem de homologação. [Checklist](V1_RELEASE_CANDIDATE_CHECKLIST.md)
