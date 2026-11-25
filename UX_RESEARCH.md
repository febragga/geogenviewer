# GeoGenViewer — pesquisa de UX e análise de referências

**Revisão:** 0.1 · 25/11/2026  
**Responsável:** Antigravity (Product Design & Frontend Engineering)  
**Estado:** investigação inicial concluída; pendente validação em dispositivo físico (tablet) após implementação da v0.1/v0.2.

---

## 1. Objetivo e método

Este documento consolida a análise crítica da experiência de usuário do **CraftBot Web Viewer** e das referências de interface indicadas para o projeto (**Rhino 8**, **Autodesk Viewer**, **Speckle**, **Onshape**, **Figma**, **Shapr3D** e **Linear**), traduzindo aprendizados em requisitos ergonômicos para desktop, tablet e smartphone.

> **Nota de rigor documental:** conforme registrado em [CRAFTBOT_ANALYSIS.md](file:///C:/Site-GeoGenViewer/CRAFTBOT_ANALYSIS.md), o código-fonte do CraftBot não foi clonado localmente nesta sessão. As observações sobre o CraftBot abaixo distinguem **evidências documentais** (README, documentação do projeto e análise técnica registrada) de **hipóteses de UX** a serem verificadas quando o visualizador for executado localmente.

---

## 2. Contexto de uso, personas e cenários prioritários

O GeoGenViewer nasce para demonstrar modelos arquitetônicos e de geometria computacional no navegador sem depender do Rhino, com primeiro estudo de caso na **maquete desmontável da Casa Gerassi** (pesquisa de iniciação científica na FAU-USP).

| Perfil | Dispositivo principal | Cenário de uso | Necessidades críticas de UX |
|---|---|---|---|
| **Pesquisador / Apresentador** (Fernando Braga) | Desktop (preparo) e **Tablet touch** (apresentação) | Conferência de exportação GLB + manifesto no desktop; demonstração ao vivo em banca, aula ou orientação usando tablet na mão ou sobre mesa | Troca rápida de arquivos locais; câmera responsiva a um dedo; isolamento rápido de pilares, vigas e lajes; vista explodida sem deriva; modo limpo sem poluição de painéis |
| **Avaliador / Orientador / Visitante técnico** | Tablet ou Smartphone | Manuseio pontual do modelo durante apresentação ou inspeção rápida por link demo sintético | Descoberta imediata dos controles básicos (orbitar, enquadrar, selecionar peça); zero dependência de atalhos ocultos; rótulos claros em português |
| **Projetista / Fabricante digital** | Desktop (mouse + teclado) | Inspeção de peças individuais, conferência de IDs, camadas, materiais e dimensões de fabricação | Árvore pesquisável, seleção sincronizada 3D ↔ lista, leitura tabular precisa com proveniência (`CAD`, `Malha`, `Informado`) e atalhos de produtividade |

### Implicação central

O **tablet em apresentação acadêmica** não é um "desktop encolhido" nem um "celular esticado": ele exige a clareza informacional de uma ferramenta técnica combinada à manipulação direta e tolerante ao toque, mantendo o viewport 3D dominante mesmo quando painéis estão abertos.

---

## 3. Análise crítica do CraftBot Web Viewer

### 3.1 Pontos fortes observados na documentação

1. **Estabilidade de câmera entre estados (Evidência documental):** ao alternar versões/iterações ou filtros no slider, a câmera permanece fixa enquanto os elementos entram ou saem, permitindo comparação espacial direta sem desorientar o observador.
2. **Múltiplos modos de leitura construtiva (Evidência documental):** visualização por camadas arquitetônicas (estrutura, fechamentos, cobertura, fundação), estilos gráficos (sombreado, monocromático, wireframe/blueprint), animação de montagem por GPU com scrubber e arranjo *knolling* para inventário de peças.
3. **Integração entre geometria e documentação (Evidência documental):** seleção e hover permanecem ativos mesmo em estados rearranjados, com callouts e ligação a texto explicativo.
4. **Leveza de distribuição (Evidência documental):** interface estática no navegador sem backend pesado de renderização.

### 3.2 Limitações e fricções para o escopo do GeoGenViewer

| Aspecto | Comportamento documentado no CraftBot | Fricção / Limite para o GeoGenViewer | Diretriz resultante |
|---|---|---|---|
| **Origem e taxonomia** | Classificação acoplada a scripts Blender e convenções de camadas por nome | Rhino/Grasshopper e outras origens exigem IDs persistentes (`extras.geogenElementId`) e camadas/grupos explícitos, sem deduzir hierarquia física pelo nome | Separar árvore lógica/camadas/grupos de sequência física de montagem ([DATA_SCHEMA.md](file:///C:/Site-GeoGenViewer/DATA_SCHEMA.md)) |
| **Fluxo de importação** | Modelos pré-publicados estaticamente no repositório | GeoGenViewer é *local-first*: o usuário carrega arquivos da máquina sem upload, podendo abrir GLB puro ou GLB + `manifest.json` | Projetar estado vazio claro (dropzone/seletor), progresso, diagnóstico explícito de erros e troca limpa de modelo |
| **Experiência touch e mobile** | Painéis recolhíveis básicos; sliders e menus de iteração pensados primariamente para desktop, exigindo rotação ou zoom manual em telas menores (hipótese baseada na documentação) | Em apresentação com tablet, sliders finos e dropdowns pequenos causam erros de toque e fadiga | Garantir alvos mínimos de `44×44 CSS px`, bottom sheets com estágios no celular e barra/scrubber adaptada para o polegar |
| **Transparência de dados** | Focado em saída procedural homogênea | No GeoGenViewer, um GLB sem manifesto não possui propriedades CAD ou passos de montagem; medidas de malha diferem de medidas CAD | Exibir selo de modo (`GLB Básico` vs `GLB + Manifesto`) e proveniência obrigatória em cada medida; ocultar/desabilitar com explicação o que não existe no arquivo |
| **Estados mutuamente exclusivos** | Alternância direta entre montagem e knolling | Explode, montagem e futuro knolling disputam transforms de repouso | Tornar o modo ativo explícito na UI (segmented control / indicador de estado) com retorno imediato à pose de repouso |

---

## 4. Benchmark das referências conceituais

Cada referência contribui com padrões específicos — e também com antipadrões a evitar para não transformar um visualizador focado em um CAD sobrecarregado.

| Referência | O que adotar no GeoGenViewer | O que evitar explicitamente |
|---|---|---|
| **Rhino 8** | Clareza do tema escuro/claro neutro; hierarquia limpa entre layers, propriedades e viewport; indicadores de eixos XYZ discretos; precisão técnica sem adornos | Excesso de painéis acoplados simultaneamente, dezenas de ícones pequenos (`< 24px`) e linha de comando textual |
| **Autodesk Viewer** | Toolbar inferior flutuante centrada nas ações essenciais (órbita, pan, zoom, enquadrar, futuro corte/medição); gestos touch previsíveis; painéis sobrepostos sob demanda | Cromos corporativos pesados, barras superiores múltiplas e menus aninhados profundos |
| **Speckle** | Topbar com contexto (`Projeto › Revisão`); painel esquerdo com abas funcionais (Árvore, Filtros/Camadas); seleção sincronizada 3D ↔ árvore; painel contextual de propriedades com leitura limpa de chave-valor e ações rápidas de isolamento; cubo de orientação | Complexidade de colaboração em nuvem (issues, comentários, streams remotos) fora do escopo do MVP |
| **Onshape** | Disciplina espacial de três zonas no desktop (estrutura à esquerda, cena no centro, inspetor à direita) e leitura numérica tabular consistente | Árvore de histórico paramétrico (*feature tree*) e controles de modelagem |
| **Shapr3D** | **Referência principal para tablet/touch:** manipulação direta sem obstrução, botões dimensionados para dedos, painéis retráteis que respeitam o espaço da mão, transição suave entre temas claro e escuro no canvas | Menus radiais proprietários difíceis de operar com mouse/teclado ou leitores de tela |
| **Figma** | Painéis laterais compactos de `240–320px` com bordas nítidas de `1px`, seções colapsáveis de propriedades (dimensões, material, metadados), tooltips educativos com atalho de teclado | UI multiusuário/cursores ao vivo e excesso de controles de edição |
| **Linear** | Precisão microtipográfica, hierarquia de contraste em tons neutros frios, microinterações rápidas (`120–180ms`), estados vazios objetivos, ausência total de ruído visual | Estética excessivamente escura sem alternativa clara (o GeoGenViewer precisa de **ambos os temas**, especialmente tema claro para ambientes iluminados / salas de aula) |

---

## 5. Síntese das decisões de UX para o GeoGenViewer

1. **Hierarquia espacial (Viewport-first):**
   - Desktop: o viewport deve ocupar **≥ 70%** da largura útil por padrão e chegar a **100%** com um clique ou atalho (`Tab` / botão de colapsar painéis).
   - Tablet: painéis são **retratéis/sobrepostos** por padrão para preservar o objeto da Casa Gerassi como protagonista da apresentação.
   - Smartphone: viewport ocupa **100%** da base; inspeção acontece por **um bottom sheet por vez**.

2. **Controle de câmera acessível sem atalhos escondidos:**
   - Embora mouse (botão esquerdo orbita, direito/Shift faz pan, scroll faz zoom) e touch (1 dedo orbita, 2 dedos pan/pinch) sejam naturais para quem usa CAD, orientadores e visitantes precisam de botões visuais explícitos na toolbar (**Enquadrar**, **Resetar vista**, alternância **Órbita/Pan** para acessibilidade com um dedo ou trackpad).

3. **Navegação segura contra conflitos de gesto (Touch):**
   - O elemento `<canvas>` deve usar `touch-action: none` para evitar scroll acidental da página ou gesto de voltar do navegador durante rotação 3D.
   - Drawers e bottom sheets devem ter cabeçalhos/alças dedicados para arraste ou botões explícitos de fechar (`×`), evitando que a tentativa de rolar uma lista mova a câmera atrás do painel.

4. **Honestidade epistemológica na interface:**
   - Em **Modo GLB Básico** (v0.1 e abertura sem manifesto), exibir apenas os dados reais da cena (nome do arquivo, malhas/nós, contagem básica de objetos) e informar de forma discreta por que propriedades CAD e timeline estão indisponíveis ("Carregue um `manifest.json` compatível para habilitar propriedades CAD e montagem").
   - Nunca exibir controles falsos ou simulados de etapas ainda não implementadas (v0.2–v0.8).

5. **Modo Apresentação (especialmente para Tablet / Casa Gerassi):**
   - Um botão único (ou atalho) recolhe chrome secundário (painéis laterais e metadados detalhados), mantendo apenas o viewport, um botão discreto para restaurar controles e, quando existir em v0.4/v0.5, o controle ativo de explode ou sequência de montagem.

6. **Tema Claro e Escuro funcionais (não apenas estéticos):**
   - **Tema Claro** como aliado de salas iluminadas, projetores acadêmicos e impressão/capturas de artigo.
   - **Tema Escuro** para sessões longas de conferência técnica e melhor contraste de modelos claros (ex.: PLA branco/cinza ou concreto).

---

## 6. Plano de validação futura (Smoke tests e usabilidade)

Quando o Codex concluir a primeira fatia da v0.1 (`/viewer` com fixture sintética e cubo de `100 mm`), validar obrigatoriamente:
1. **Desktop (`1440×900` e `1280×720`):** abertura de GLB local, feedback de erro com arquivo corrompido/não-GLB, troca por um segundo GLB sem vazamento visível, uso de teclado (`Tab`, `Enter`, `Esc`).
2. **Tablet em emulação (`1024×768` paisagem e `768×1024` retrato) e tablet físico quando disponível:** medição real de alvos de toque (`>= 44px`), ausência de overflow horizontal e fluidez de órbita/pan/fit.
3. **Smartphone em emulação (`390×844`):** verificação de que a toolbar e avisos não cobrem o modelo nem quebram a barra do navegador móvel (`100dvh`).
