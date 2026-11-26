# GeoGenViewer — handoff

- **Versão consolidada na entrega local:** `0.9.0` (`v0.9.0`)
- **Data:** 26/11/2026
- **Branch de trabalho alvo:** `feat/v0.9-product-design-performance` (criada localmente pelo responsável em `6563d7d`, idêntico à `main`; alterações da V0.9 aguardam apenas `git switch` / `commit` no terminal do usuário porque o sandbox bloqueia locks em `.git/`)
- **Responsável pelas decisões:** Fernando Braga

## Estado consolidado (V0.1–V0.9)

- **V0.1–V0.8:** Visualizador GLB local, manifesto CAD `1.0.0`, vista explodida, múltiplas viewports, timeline/editor de montagem, inspeção com clipping/medições, comparação de revisões/quantitativos/fabricação, knolling, catálogo e documentação técnica imprimível.
- **V0.9 (`Product Design, Performance, Robustness & User Organization`):**
  - Marca triangular `#3B82F6`, versão centralizada `0.9.0` (`src/lib/geogen/version.ts`), web manifest e Home Launchpad com showcase interativo, biblioteca de 6 demos, projetos recentes e documentação em abas.
  - Cubo de Navegação 3D sólido chanfrado em SVG (26 faces/arestas/cantos, arrasto, Home, rotação 90°, toggle `Persp./Orto.`) em contexto WebGL único + topbar agrupada em 4 famílias de workspace.
  - Sistema independente de Camadas e Grupos do Usuário (`schemas/organization-v1.schema.json`), com Undo/Redo, separação estrita do CAD, camada única por ocorrência, grupos sobrepostos, exclusão com escolha explícita, Menu de Contexto 3D/árvore e integração com Filtros, Cor por camada, Quantitativos, Knolling e Catálogo.
  - Diálogo consolidado de **Configurações**, `CommandPalette` ampliado e cancelamento explícito de carga (`AbortController`).
  - Batching GPU com `InstancedBatchManager` (reduzindo `10.001` para `2` draw calls em 10.000 peças sem regredir os `24`/`96` draw calls do pavilhão de 18 peças), cache de matrizes no `KnollingPose`, cache de busca no `catalog.ts` e cache no `DocumentationOverlay`/`callouts.ts`.

## Documentação e evidências V0.9

- [Auditoria](V09_PRODUCT_DESIGN_AUDIT.md) · [Implementação](V09_IMPLEMENTATION_REPORT.md) · [Testes](V09_TEST_REPORT.md) · [Desempenho](V09_PERFORMANCE_REPORT.md) · [Design System](V09_DESIGN_SYSTEM.md) · [Brand Guidelines](V09_BRAND_GUIDELINES.md) · [Cubo 3D](V09_NAVIGATION_CUBE_SPEC.md) · [Organização do Usuário](V09_USER_ORGANIZATION_SPEC.md) · [Segurança](V09_SECURITY_AUDIT.md) · [Acessibilidade](V09_ACCESSIBILITY_REPORT.md) · [Guia do Usuário](V09_USER_GUIDE.md) · [Evidências](docs/v09/evidence/)

## Verificações executadas

- `npm --prefix geogenviewer run lint` (0 erros, 0 warnings), `typecheck` (0 erros), `npm test` (62/62 aprovados), `next build` e 6 suítes Playwright (`test:ui`, `test:v05`, `test:v06`, `test:v07`, `GEOGEN_V08_GPU=1 test:v08`, `test:v09`) aprovadas com 0 violações `axe` e 0 overflow em 6 resoluções (`1920×1080`, `1440×900`, `1280×800`, `1024×768`, `768×1024`, `390×844`).

## Pendências antes da V1.0

- Homologação em **tablet e smartphone físicos**, execução integrada com **GeoGenExporter no Rhino 8 real** e validação com **modelo autorizado da Casa Gerassi** (nenhum arquivo privado da IC incluído no repositório).
- Executar `git switch feat/v0.9-product-design-performance` e comitar as alterações da V0.9 no ambiente local fora do sandbox.
