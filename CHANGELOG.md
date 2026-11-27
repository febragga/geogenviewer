# Changelog

## [0.9.12] · 27/11/2026 — Candidata à homologação

- **Sprint C:** corrige o descarte de materiais do GTAO, evita invalidar seu programa a cada quadro e mantém o raio e a espessura de oclusão proporcionais ao modelo.
- O PNG de Clay respeita a exposição em Desempenho nos renderers com suporte a buffers de cor em ponto flutuante. O passe de sombras roda no desenho de cor, e o GTAO é dispensado quando sua intensidade é zero.
- Mono conserva as cores da paleta entre viewport e PNG e aplica o ajuste de espessura abaixo de 1 px. Blueprint ativa o esquema escuro dos controles nativos e restaura a preferência anterior na saída. Bayer 8×8 usa a ordenação recursiva correta.
- Auditoria de GLB, manifesto, ferramentas, persistência e PNG, com medições do renderer e checklist manual. [Auditoria e matriz](SPRINT_C_RELEASE_AUDIT.md) · [Desempenho](SPRINT_C_PERFORMANCE_REPORT.md)

### Sprint A e Sprint B · 26/11/2026

- **Sprint B (Modos gráficos e identidade):**
  - **Mono 2.0:** superfícies unlit (`#151515`), arestas construtivas ocluídas (`#F5F5F5`) com espessura configurável via `LineSegments2`, fundo `#FAFAF8`, inversão B/W e cores personalizáveis.
  - **Blueprint + Tema UI:** cena técnica (`#102E50` / `#234B70` / `#BCDFFF`), seleção ciano `#54E6FF`, grade dedicada e tema completo da interface (`#0B1D30`) com sincronização opcional e restauração do tema prévio.
  - **Dither:** shader Bayer `4×4` e `8×8` isolado da UI (`#F3F1EB` / `#202020`), controles de intensidade/contraste/escala/inversão/arestas e preservação de transparência em PNG.
  - **Clay:** estúdio de maquete (`#D9D4CB` / `#EEECE7` / `#E5E2DC`), rig com rim light, `GTAOPass` sensível à escala em `displayEffectFactories.studio`, exposição/AO ajustáveis e fallback por orçamento.
  - Refinamento do menu **Exibição** (cards de preset + ajustes contextuais), **Resumo** tabular agrupado e **Knolling** com cabeçalhos acima dos grupos e paleta adaptativa.
  - [Relatório Sprint B](SPRINT_B_DISPLAY_MODES_REPORT.md)
- **Sprint A:** PartID preferencial, Knolling com orientação/títulos, Resumo na viewport e infraestrutura de modos gráficos.
- [Handoff dos modos gráficos](DISPLAY_MODES_HANDOFF.md) · [Regressões e limitações](V0912_REGRESSION_REPORT.md)

## [0.9.11] · 26/11/2026 — Apresentação pública

- Remoção dos links públicos para o GitHub na Home e em Configurações → Sobre.

## [0.9.1] · 26/11/2026 — Auditoria e estabilização

- Pré-validação GLB e vínculo único de malhas a ocorrências do manifesto CAD.
- Organização com escopo por hash, projeto e revisão, máscaras de grupos independentes e histórico atômico ao criar uma camada com a seleção.
- Fallback de renderização para transparência, transformações incompatíveis e exibição técnica. Picking com limites atualizados e ancoragem na malha original.
- Preferências de tema compartilhadas entre home e viewer, metadados de produção e versão centralizada.
- Cancelamento e recuperação, diagnóstico de armazenamento e indicação do limite de ilustrações do manual.
- [Auditoria](V091_ENGINEERING_AUDIT.md) · [Checklist V1.0](V1_RELEASE_CANDIDATE_CHECKLIST.md)

## [0.9.0] · 26/11/2026 — Product Design, Performance, Robustez e Organização do Usuário

- Identidade visual oficial com marca triangular `#3B82F6`, versão centralizada `0.9.0` e web manifest completos.
- Home Launchpad renovada com showcase interativo (*Montado*, *Explodido*, *Knolling*), biblioteca de 6 demonstrações, **Projetos Recentes** em metadados leves e documentação técnica em abas.
- Cubo de Navegação 3D sólido chanfrado em SVG (26 faces/arestas/cantos em contexto WebGL único, arrasto contínuo, Home, rotação 90° e toggle `Persp./Orto.`) e navegação de workspaces agrupada em 4 famílias.
- Sistema independente de **Camadas e Grupos do Usuário** (`schemas/organization-v1.schema.json`), com separação estrita do CAD, camada única por ocorrência, grupos sobrepostos, Undo/Redo, modal explícito de exclusão, drag-and-drop, Menu de Contexto e integração com Filtros, Quantitativos, Knolling, Catálogo e Cor por camada.
- Diálogo consolidado de **Configurações** (tema, fundo independente da viewport, Cubo 3D, qualidade, modo automático para modelos grandes e unidades), `CommandPalette` ampliado e cancelamento de carregamento com `AbortController`.
- Otimização WebGL com `InstancedBatchManager` (`10.001` → `2` draw calls nos benchmarks de 10.000 peças, mantendo `24`/`96` draw calls no pavilhão de 18 peças), cache de matriz pai no `KnollingPose`, cache de busca em `catalog.ts` e cache de projeção/medição em `DocumentationOverlay`/`callouts.ts`.

## [0.8.0] · 26/11/2026 — Knolling, catálogo e documentação

- Organização de ocorrências e tipos em cinco modos, três planos CAD, orientação configurável e transição reversível.
- Catálogo virtualizado, filtros, miniaturas no renderer existente e seleção por revisão e ocorrência.
- Callouts ancorados, listagem de peças, fichas técnicas e manual imprimível baseado em montagem autorada.
- Exportações PNG, CSV e JSON, restauração vinculada ao hash e fixture sintética com duas revisões.

## [0.7.0] · 26/11/2026 — Comparação de revisões e fabricação

- Workspaces Comparar e Quantitativos com navegação em uma viewport e suporte a dois pacotes locais.
- Correspondência persistente e assistida, decisões manuais, alinhamento, leitura de mudanças geométricas e semânticas e comparação de inspeções.
- Contagem por ocorrência, cobertura, biblioteca de materiais, massas por método, custos por moeda e cenários.
- Documentos independentes de comparação e fabricação, CSV, captura PNG e laboratório sintético.
- O manifesto CAD 1.0.0 e o schema de inspeção V0.6 continuam sendo as interfaces de importação.

## [0.6.0] · 25/11/2026 — Consolidação Git (`main`) e Inspeção Espacial

- Consolidação do histórico completo das versões V0.1–V0.6 na branch principal `main` e publicação da release `v0.6.0`.
- Workspace Inspecionar, três planos CAD reversíveis, cortes por região e cap validado por topologia.
- Picking e snapping compatíveis com clipping, medições locais nas poses original e temporária.
- Named Views com estado de inspeção e leitura do formato V0.5.
- PNG técnico com cotas, IDs, régua ortográfica e metadados associados à captura.
- Schema independente de inspeção (`inspection-v1.schema.json`) e laboratório sintético (`inspection-lab`) com cubo de 100 mm e folga de 0,13 mm.
- Auditoria do baseline, 33 testes automatizados, três suítes Playwright e benchmarks da V0.6.
- Homologações ainda pendentes fora do ambiente sintético: GeoGenExporter no Rhino 8 real, validação em tablet físico e modelo real autorizado da Casa Gerassi.

## V0.5 — Experiência do visualizador e montagem

- Workspaces Explorar, Explodir e Montagem com cena compartilhada.
- Perspectiva, ortográfica, vistas por orientação, cubo e layouts com até quatro câmeras.
- Filtros combináveis, agrupamentos semânticos, vistas nomeadas e combinações salvas no navegador.
- Modos de apresentação, PNG, qualidade gráfica e diagnóstico de render.
- Timeline determinística e editor de montagem com exportação de manifesto validado.
- Pavilhão sintético atualizado com sequência de seis etapas e preservação do hash do GLB.
- Auditoria, guia de uso, testes automatizados e benchmarks da V0.5.

## V0.4 — Vista explodida

- Modos radial, axial, direcional e hierárquico, escopos de explosão e linhas de referência.
- Fixture do pavilhão sintético, testes de pose e benchmark de atualização.

## V0.2–V0.3 — Inspeção e importação

- Seleção semântica, árvore, visibilidade, propriedades e importação GLB com manifesto 1.0.0.
