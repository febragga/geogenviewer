# GeoGenViewer V0.9.12 · regressões e limitações

## Auditoria antes da implementação

| Verificação | Resultado |
| --- | --- |
| Checkout inicial | Árvore limpa na branch `fix/v0.9.11-public-github-links`, commit `6b8ee4d`, tag `v0.9.11` |
| Upstream inicial | A branch local e a remota estavam no mesmo commit. O desvio era 0/0 |
| Base da Sprint A | Após consultar e atualizar `origin/main`, o commit remoto era `eeb02e2`. A `main` local `dea4d20` estava dois commits atrás. A árvore de `eeb02e2` era idêntica à da tag `v0.9.11` |
| Versão | `0.9.12` no aplicativo e npm, sucessora de `0.9.11`. Branch `feat/v0.9.12-sprint-a` derivada de `origin/main` |
| Importação | GLB 2.0 local via GLTFLoader e manifesto CAD 1.0.0 validado com Ajv. Identidade vinculada por extras ou nome conforme estratégia do contrato |
| Motores | Canvas React Three Fiber, controladores Three.js, Zustand, CSS semântico e Base UI. Quantitativos e cenários do fluxo de fabricação estão em `revisions/quantities.ts` e `revisions/fabrication.ts`. As funções atribuídas ao CostGen usam esse pipeline integrado |
| Nomes de origem | `GeoGen:PartId` já é usado nas fixtures de catálogo e revisão. `geogen.v02.partId`, fornecido para esta sprint, tem precedência. Os mapas `properties`, `userText` e GLB extras suportam os aliases no resolvedor. O nome original GLB vem das associações do parser |
| Modos legados | Sombreado, Materiais GLB, Monocromático, Técnico, Aramado, Raio X e três estilos semânticos. A chave legada `clay` é aberta como Mono |

## Cobertura de regressão

| Área | Evidência |
| --- | --- |
| GLB básico e com manifesto | Fixtures sintéticas com IDs presentes, ausentes e repetidos, nomes brutos do GLB, manifesto CAD 1.0.0 e aliases antigos e novos. Recuperação e cancelamento verificados em navegador |
| Seleção e pesquisa | PartIDs duplicados permanecem ocorrências independentes. Pesquisa utiliza nomes de origem e IDs. Navegador verifica seleção durante a alternância de modos e pesquisa de nomes originais no catálogo |
| Quantidades | Escopos, cinco agrupamentos, precedência CAD, cobertura parcial, valores desconhecidos, volume geométrico e informado para fabricação, massa nominal e métodos de consumo |
| Knolling | Verificação de folgas, determinantes, poses em repouso e determinismo. O navegador testa duas orientações novas, rótulos de etapas e restauração de títulos após recarga |
| Explodir e Montagem | Testes existentes de restauração de matrizes, visibilidade, reprodução, scrubbing e captura. A regressão V0.9.1 repete 100 ciclos de poses |
| Renderer | Todos os modos, referências dos materiais originais, descarte de arestas, picking por ocorrência, fallback do efeito, migração de vistas e controle de qualidade |
| Exportação | PNG de Clay com chão, sombras e fundo, além de Dither com transparência no perfil convencional. A suíte V0.8 também verifica PNG, JSON, CSV, fichas e PDF imprimível |

## Execução local

Os comandos abaixo são executados de `geogenviewer/`. Chrome 159.0.8154.33 em Windows com ANGLE/SwiftShader nos testes direcionados da Sprint A. Foram usados dados sintéticos.

| Comando | Escopo |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Passaram. 79 testes automatizados e build de produção concluído |
| `npm run test:v0912` | Passou. Identidade, Resumo, gráficos, PNG e Knolling. Sem erros de página, requisições externas ou violações axe no popover em 375 × 800, 900 × 700 e 1440 × 900 |
| `npm run test:v05`, `npm run test:v06`, `npm run test:v07`, `npm run test:v08` | Passaram. Navegação, filtros, montagem, inspeção, comparação, fabricação e documentação |
| `npm run test:ui`, `npm run test:v091` | Passaram. Layout, acessibilidade, importação e recuperação de contexto |
| `npm run benchmark:v091` | Passou. Restauro de 10.000 ocorrências em ambas as configurações e picking esperado. Os draw calls desse ensaio são estimados no CPU |
| `npm run benchmark:v08` | Passou. CPU com 100, 1.000 e 10.000 ocorrências. Uma amostra com 10.000 registrou 479 ms de importação, 52 ms de catálogo e 47 ms de layout. A fixture compartilhou uma geometria, liberada no descarte |

Os JSON e screenshots gerados pelo Playwright ficam no diretório ignorado `test-results`. O relatório focado está em `test-results/v0912/report.json`.

## Limitações

- Dither usa o fallback sombreado. Oclusão, sombras de contato dedicadas e o acabamento artístico dos perfis ficam na Sprint B. Clay já tem material fosco, iluminação e sombras PCF opcionais.
- A exposição de Clay é aplicada na viewport. O PNG offscreen convencional segue o comportamento de tone mapping do Three.js para render targets. O handoff descreve como integrar e verificar um passe de saída.
- Maior face e Eixo principal derivam da malha tessellada e podem ser aproximados em superfícies curvas, geometrias com simetria ou triangulação densa. O algoritmo de disposição usa caixas conservadoras. As etapas sem sequência autorada são agrupadas por categoria, sem inferir montagem.
- A opção visível no Resumo segue a máscara de componentes da viewport ativa. As medições abrangem peças inteiras, inclusive quando um plano de corte recorta parte delas na tela. O Resumo aparece na viewport do modelo principal. A comparação de duas revisões mantém seus quantitativos por revisão.
- Massa nominal deriva de volume e densidade disponíveis. Registros de massa medida, fatiador e estimativa permanecem distintos. Custos representam material por método e moeda, sem converter moedas ou estimar custos ausentes.
- O teste de tablet e celular foi emulado. Permanecem pendentes a revisão em dispositivo físico, o uso de modelo autorizado da Casa Gerassi, a homologação do exportador no Rhino 8 e a medição dos efeitos da Sprint B em GPU real.
