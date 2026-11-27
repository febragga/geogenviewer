# GeoGenViewer Sprint B · modos gráficos

Este documento registra o ponto de partida da Sprint A. Para os passes implementados e a candidata auditada, consulte o [relatório da Sprint B](SPRINT_B_DISPLAY_MODES_REPORT.md) e a [auditoria da Sprint C](SPRINT_C_RELEASE_AUDIT.md).

Base local `feat/v0.9.12-sprint-a`, aplicação `0.9.12`. O App Router carrega o viewer no cliente. O pipeline usa React Three Fiber 9.8.2, Three.js 0.187.0, WebGL e Zustand. As dependências instaladas incluem os utilitários Three.js para composição e oclusão.

## Renderização e integração

| Arquivo em `geogenviewer/` | Responsabilidade |
| --- | --- |
| [viewport.tsx](geogenviewer/src/features/viewer/scene/viewport.tsx) | Canvas único sob demanda, luzes, sombras, chão, grade, eixos e controlador de poses |
| [viewport-cameras.ts](geogenviewer/src/features/viewer/scene/viewport-cameras.ts) | Câmeras, controles, regiões via scissor, enquadramento, PNG e chamada do pipeline de desenho |
| [display.ts](geogenviewer/src/features/viewer/scene/display.ts) | `SceneDisplay.apply` configura materiais, destaque, visibilidade, sombras e arestas. Mantém referências aos materiais originais |
| [instancing.ts](geogenviewer/src/features/viewer/scene/instancing.ts) | Lotes compartilhados, associação de hits aos IDs, malhas de destaque e fallback de arestas ou transparência |
| [inspection-scene.ts](geogenviewer/src/features/viewer/scene/inspection-scene.ts) | Clipping, gizmos, tampas e medidas. Invoca o desenho com o estado temporário da inspeção |
| [display-profiles.ts](geogenviewer/src/features/viewer/scene/display-profiles.ts) | `displayProfile`, `graphicBudget`, materiais, arestas, iluminação, sombras, exposição, tema e intenção de efeito |
| [display-pipeline.ts](geogenviewer/src/features/viewer/scene/display-pipeline.ts) | `createDisplayPipeline`, `displayEffectFactories`, `DisplayEffect` e `EffectFrame` |
| [presentation-store.ts](geogenviewer/src/features/viewer/state/presentation-store.ts) | `DisplaySettings`, preferências correntes e `CameraAccess.capture` |
| [settings-store.ts](geogenviewer/src/features/viewer/state/settings-store.ts) e [local-preferences.ts](geogenviewer/src/features/viewer/state/local-preferences.ts) | Preferências em `geogen:v09:settings` e leitura de vistas nomeadas legadas |
| [comparison-scene.tsx](geogenviewer/src/features/viewer/scene/comparison-scene.tsx) e [documentation-renderer.tsx](geogenviewer/src/features/viewer/scene/documentation-renderer.tsx) | Comparação com estilo semântico próprio e ilustrações documentais usando o mesmo WebGL, com configuração isolada |

O rig aplica câmera, pose e filtros à região corrente. `SceneDisplay` escolhe superfícies e arestas. A inspeção prepara a cena para o desenho. O callback gráfico renderiza no framebuffer corrente. A leitura para PNG reutiliza esse callback com o destino de captura e então compõe anotações e o fundo pedido. Câmeras, máscaras, filtros, poses, seleção e ferramentas de inspeção permanecem nas respectivas stores e controladores durante trocas de modo.

## Perfis disponíveis

| Modo | Identificador | Comportamento da Sprint A | Integração para a Sprint B |
| --- | --- | --- | --- |
| Mono | `mono` | Material fosco do monocromático anterior | Ajustar `material` e `edges` do perfil |
| Blueprint | `blueprint` | Superfície técnica, arestas, fundo e acento provisórios | Revisar o perfil e os tokens CSS do tema |
| Dither | `dither` | Fallback sombreado convencional | Registrar uma fábrica em `displayEffectFactories.dither` e usar `profile.shader` no passe |
| Clay | `clayStudio` | Material uniforme fosco, hemisférica e duas direcionais, fundo neutro, exposição na viewport e sombras PCF quando habilitadas | Ajustar o estúdio e registrar `displayEffectFactories.studio` para oclusão e contato |

Uma vista salva com `mode: "clay"` é aberta como `mono`, com a cor e a rugosidade legadas. `clayStudio` identifica o novo Clay. `restoreDisplay` valida as opções conhecidas e conserva o restante da vista. A exposição de Clay é limitada a 0,25–2. O seletor de exibição grava a escolha do modo e da qualidade localmente. Aplicar uma vista nomeada restaura o snapshot da sessão. O modo automático de modelo grande pode reduzir a qualidade em tempo de execução.

## Tema e controles

[globals.css](geogenviewer/app/globals.css) concentra `--gg-bg-app`, `--gg-bg-viewport`, `--gg-bg-panel`, `--gg-text-primary`, `--gg-text-muted`, `--gg-accent`, `--gg-accent-hover` e os tokens de bordas, foco e espaçamento. A viewport aplica `data-mode-background` apenas com fundo **Tema**. Branco e Grafite são escolhas explícitas. O viewer aplica `data-graphics-theme` enquanto o Blueprint está ativo. O CSS estende a cor de destaque aos portais Base UI. A preferência de claro, escuro ou sistema continua em `meta[name="color-scheme"]`.

- **Resumo** usa [model-summary.tsx](geogenviewer/src/features/viewer/components/model-summary.tsx), `ViewerPopover` e o motor de [quantitativos](geogenviewer/src/lib/geogen/revisions/model-summary.ts). O escopo visível segue a região ativa e a máscara do Knolling. Valores parciais incluem cobertura. Para alterar o visual, mantenha rótulos dos campos, foco do Base UI e área rolável em telas compactas.
- **Knolling** usa `KnollingControls` em [documentation-panel.tsx](geogenviewer/src/features/viewer/components/documentation-panel.tsx), `useDocumentationWorkspace`, `layoutKnolling` e `KnollingPose`. `describeAssembly` gera os rótulos. A renomeação local usa os IDs das etapas ou categorias e é exportável nos documentos Knolling e nas vistas salvas. Os parâmetros de orientação funcionam em XY, XZ e YZ. Os títulos e callouts em canvas passam por `DocumentationOverlay`.

## Integração de efeitos

1. Registre uma fábrica em `displayEffectFactories`. Ela recebe o renderer existente e o `DisplayProfile` e pode retornar `null` quando os recursos do dispositivo forem insuficientes.
2. Use `EffectFrame.width`, `height` e `scale` para dimensionar buffers reutilizáveis. A viewport informa dimensões em CSS px e a captura informa pixels do destino. O rig usa o render convencional quando o adaptador retorna `false` ou falha.
3. Respeite a câmera, o alvo corrente, o canal alfa solicitado e o espaço de cor. Preserve viewport, scissor, clipping e materiais durante passes intermediários. A pipeline protege destino, viewport, scissor, cor e alfa de limpeza, `autoClear`, fundo, material de override e exposição. Se o passe alterar outros estados, restaure-os dentro do passe.
4. Libere render targets, materiais auxiliares e passes em `dispose()`. O rig encerra o adaptador ao trocar de modo, perder o orçamento para efeitos ou trocar a cena.
5. Valide PNG com fundo CSS e transparência. A captura offscreen convencional de Three.js continua usando seu espaço de cor e dispensa o tone mapping de tela. Para reproduzir exposição e composição na Sprint B, teste um passe final de saída antes de ler o destino.

## Clay e orçamento

O pacote instalado inclui `three/addons/postprocessing/EffectComposer.js`, `ShaderPass.js`, `SSAOPass.js`, `GTAOPass.js` e `OutputPass.js`. SSAO e GTAO são alternativas de tela que exigem profundidade ou normais e buffers próprios. Teste primeiro um único passe em `studio` com resolução reduzida. Confirme suporte a projeção ortográfica, transparência, clipping e tamanho máximo de textura. Sombras de contato podem compartilhar o passe de profundidade quando o adaptador oferecer essa função. O fallback usa PCF convencional com plano receptor opcional. A Sprint A registra a intenção de GTAO e de contato no perfil. Os passes e a direção artística ficam para a Sprint B.

| Qualidade | DPR máximo | Sombras | Efeitos secundários |
| --- | --- | --- | --- |
| Desempenho | 1 | 512 px quando habilitadas | Convencional |
| Equilibrada | 1,5 | 1024 px | Até 0,5× por eixo |
| Alta | 2 | 2048 px | Até 0,75× por eixo |
| Múltiplas regiões ou viewport abaixo de 640 px | 1,5 em múltiplas regiões. Em uma região vale o preset | 512 px | Convencional |

Clipping ativo, capturas técnicas e comparação seguem pelo caminho convencional. Evite passes que reintroduzam draw calls por ocorrência ou dupliquem um Canvas. Na adoção de efeitos, acompanhe draw calls, custo em GPU, p95 de quadro e recuperação após perda de contexto.

## Validação

Em `geogenviewer/`, execute `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:v0912`. O Playwright inicia a versão de produção e registra o resultado em `test-results/v0912/report.json`. `npm run test:v08` cobre documentação, miniaturas e benchmarks de Knolling. `npm run test:v091` verifica organização e recuperação de importação e WebGL.

Exercite todos os modos em sequência, alternância entre vistas com e sem clipping, qualidade Desempenho, abertura de outro modelo, viewport múltipla e PNG com e sem transparência. Confira a restauração do tema anterior, da câmera, dos filtros e da seleção. Os testes usam modelos sintéticos. O tablet físico e a geometria autorizada da Casa Gerassi fazem parte da homologação.
