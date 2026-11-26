# GeoGenViewer V0.9 — Relatório de Implementação

**Versão:** `0.9.0` (`v0.9.0`) · **Contrato CAD JSON preservado:** `1.0.0` · **Data:** 26/11/2026

---

## 1. Resumo Executivo

A sprint **V0.9 — Product Design, Performance, Robustness & User Organization** consolidou o GeoGenViewer antes da V1.0 sem quebrar o contrato de intercâmbio `1.0.0`, os motores geométricos V0.2–V0.8 ou o princípio estrito *local-first*.

---

## 2. Entregas Realizadas

1. **Identidade de Marca e Versão Centralizada (`Phase B`):**
   - Constantes centralizadas em `geogenviewer/src/lib/geogen/version.ts` (`GEOGEN_VERSION = "0.9.0"`, `GEOGEN_BRAND_BLUE = "#3B82F6"`), `package.json`, `package-lock.json` e `app/manifest.ts`.
   - Ativos do símbolo triangular azul (`#3B82F6`) gerados por `scripts/generate-brand-assets.mjs` (`icon.svg`, `favicon.ico`, `apple-icon.png`, ícones 192/512, marca SVG e imagem OG).
2. **Home Launchpad Renovada (`src/features/home/` + `app/home.css`):**
   - Hero *"Da geometria à montagem."* com showcase interativo (*Montado*, *Explodido*, *Knolling*), Biblioteca de 6 demonstrações, seção **Projetos Recentes** em metadados leves e documentação técnica em abas.
   - Suporte a deep links `/viewer?demo=revisao`, `/viewer?demo=catalog` e `/viewer?open=1`.
3. **Cubo de Navegação 3D Sólido e Navegação por Famílias (`Phase C`):**
   - Poliedro chanfrado sólido em `src/lib/geogen/domain/nav-cube.ts` e `navigation-cube.tsx` (26 faces/arestas/cantos com rotulação afim 3D, arrasto contínuo para órbita, `Home`, rotação ±90° via `CameraAccess.rotate90` e alternância `Persp./Orto.`, operando em contexto WebGL único).
   - Agrupamento dos 8 workspaces em 4 famílias na topbar (`Visualização`, `Inspeção`, `Análise`, `Documentação`), mantendo compatibilidade total do `<select aria-label="Workspace">`.
4. **Sistema Independente de Organização do Usuário (`Phase D`):**
   - Schema `geogenviewer/schemas/organization-v1.schema.json`, motor `src/lib/geogen/organization/{model,operations,document}.ts` e store `organization-store.ts` com Undo/Redo (50 passos) e persistência por SHA-256/revisão.
   - Separação estrita entre estrutura CAD imutável (`cad`) e camadas/grupos do usuário (`user`), regra de camada direta única por ocorrência, grupos sobrepostos, ação `Copiar CAD`, exclusão com escolha explícita (`Mover para camada superior` vs `Remover atribuição`), drag-and-drop e Menu de Contexto (botão direito 3D/árvore + trigger tátil `⋮`).
   - Integração completa com **Filtros** (`userLayer`/`userGroup`), **Cor por camada**, **Quantitativos** (sem contagem dupla), **Knolling** e **Catálogo**.
5. **Refinamentos de UX, Configurações e Robustez (`Phases E & G`):**
   - Diálogo consolidado **Configurações** (`settings-dialog.tsx` + `settings-store.ts`) incluindo fundo independente da viewport e modo automático para modelos grandes.
   - `CommandPalette` (`Ctrl+K`) expandido com busca tolerante a acentos, workpaces, vistas padrão, camadas e grupos do usuário.
   - Cancelamento explícito de carregamento com `AbortController` (`cancelActiveLoad`) descartando cargas incompletas com segurança.
6. **Otimização de Renderização e Memória (`Phase F`):**
   - Batching automático via `InstancedMesh` (`InstancedBatchManager`, redução de `10.001` para `2` draw calls em benchmarks sintéticos de 10.000 ocorrências), cache de matriz pai no `KnollingPose`, cache de busca em `catalog.ts` e otimização do `DocumentationOverlay` / `callouts.ts`.

---

## 3. Documentos Produzidos na V0.9

- [`V09_PRODUCT_DESIGN_AUDIT.md`](V09_PRODUCT_DESIGN_AUDIT.md)
- [`V09_DESIGN_SYSTEM.md`](V09_DESIGN_SYSTEM.md)
- [`V09_BRAND_GUIDELINES.md`](V09_BRAND_GUIDELINES.md)
- [`V09_NAVIGATION_CUBE_SPEC.md`](V09_NAVIGATION_CUBE_SPEC.md)
- [`V09_USER_ORGANIZATION_SPEC.md`](V09_USER_ORGANIZATION_SPEC.md)
- [`V09_PERFORMANCE_REPORT.md`](V09_PERFORMANCE_REPORT.md)
- [`V09_SECURITY_AUDIT.md`](V09_SECURITY_AUDIT.md)
- [`V09_ACCESSIBILITY_REPORT.md`](V09_ACCESSIBILITY_REPORT.md)
- [`V09_TEST_REPORT.md`](V09_TEST_REPORT.md)
- [`V09_USER_GUIDE.md`](V09_USER_GUIDE.md)
