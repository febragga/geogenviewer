# Auditoria do visualizador V0.5

## Ponto de partida

A revisão local estável da V0.4 é `c20be20`, em `feat/v0.4-exploded-view`. A branch de trabalho foi aberta nesse commit com a árvore limpa. A branch remota conhecida termina no bootstrap `cf32e33`.

A V0.4 já oferece importação GLB e manifesto, picking por identidade, árvores de componentes, layers e grupos, propriedades com proveniência, painéis responsivos, modo foco e explosão com poses de repouso. O Canvas R3F opera sob demanda. A câmera perspectiva única e o raycast de tela inteira eram a fronteira da navegação. O manifesto validava os passos, mas o pacote carregado expunha apenas a projeção semântica necessária à interface.

O baseline local aprovou 13 testes, lint, typecheck, build e a auditoria Playwright existente. O viewport de 1440 × 900 ocupava 882 × 856 CSS px com ambos os painéis. A auditoria registrou zero violações axe e zero requisições externas.

## Referência CraftBot

Código público inspecionado no SHA `2d52c09288c34f8b0e95157c213c4ed883ef59eb`, sob licença MIT. A URL publicada com a maquete VIPP não abriu no conector de navegação; a análise funcional foi feita no código do viewer. [Código de referência](https://github.com/lukapiskorec/craftbot/tree/2d52c09288c34f8b0e95157c213c4ed883ef59eb/viewer)

| Arquivo | Comportamento observado | Aplicação local |
|---|---|---|
| `views.js`, `styles.js` | OrbitControls, câmeras ortográficas, mapa tela/câmera e render por viewport e scissor. Passes pós-processados reutilizam alvos por tamanho. | Regiões no único Canvas R3F e câmera por região. |
| `main.js`, `gui.js` | Controles agrupados por modelo, estilo, layers, animação e corte. | Agrupar comandos por tarefa e aproveitar os painéis e tokens existentes. |
| `viewcube.js` | Cubo ortográfico com raycast de regiões e interação por ponteiro. | Cubo com os mesmos controles de orientação da câmera da cena. |
| `sections.js`, `picking.js` | Planos de clipping com controles por eixo e descarte de interseções cortadas no picking. | Reservar integração de corte para a V0.6. |
| `scene.js`, `model-data.js` | Caixas instanciadas e malhas agrupadas com lookup de instância/face; classificação em camadas de render. | Preservar nós GLB, compartilhamento de geometria por instância e IDs de origem. |
| `rationale.js`, `callouts.js`, `styles.js` | Apresentação orientada por relatório, destaques e estilos de cena. | Preparar apresentação por vistas nomeadas, fundo e captura de PNG. |

A organização e os padrões de interação serviram como referência. O código, a geometria e a identidade visual da referência ficaram fora do projeto.

## Reorganização da sprint

O marco V0.5 anterior concentrava a sequência construtiva. A solicitação amplia o marco para gerenciamento de vistas, filtros, apresentação e integração entre Explorar, Explodir e Montagem. As verificações de Rhino físico e as ferramentas avançadas de documentação seguem no roadmap.

A revisão visual aproveita Base UI, CSS e os tokens existentes, com consulta local à skill UI/UX Pro Max. O Superdesign CLI retornou sessão sem autenticação; o fluxo de design e validação foi local, conforme a política do projeto.
