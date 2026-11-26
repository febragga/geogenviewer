# Changelog

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
