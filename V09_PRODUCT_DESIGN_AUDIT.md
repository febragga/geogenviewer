# GeoGenViewer V0.9 — Auditoria de Produto, Design e Desempenho

**Data:** 26/11/2026  
**Branch de trabalho:** `feat/v0.9-product-design-performance` (base `main` em `6563d7d`, release `v0.8.0`)  
**Objetivo:** Consolidar achados visuais, ergonômicos, funcionais, de desempenho, segurança e acessibilidade nos oito workspaces antes da implementação da V0.9.

---

## 1. Baseline Reproduzido (Antes das Alterações)

Todas as verificações existentes foram reproduzidas localmente sobre `6563d7d` (`v0.8.0`):

- **Estáticos e build:** `npm --prefix geogenviewer run lint` (0 erros), `npm --prefix geogenviewer run typecheck` (0 erros), `npm --prefix geogenviewer run build` (Next.js 16.4.6 Turbopack concluído para `/`, `/_not-found`, `/viewer`).
- **Testes unitários e de integração:** `npm --prefix geogenviewer test` → **55/55 aprovados** em `852,22 ms` (`0` falhas, `0` ignorados).
- **Suítes Playwright (`Chrome + SwiftShader`, 6 resoluções até `1920×1080` e `390×844`):** `test:ui`, `test:v05`, `test:v06`, `test:v07` e `test:v08` aprovadas com `1` contexto WebGL ativo, `0` violações `axe` nos estados auditados e `0` overflow horizontal.
- **Benchmarks CPU reproduzidos (`Win32 x64`, Node `v22.14.0`):**
  - `benchmark:v07` (10.000 peças × 2 revisões): `loadBothMs: 559,913 ms`, `matchingMs: 5,615 ms`, `geometryAndDiffMs: 116,353 ms`, `quantitiesAndFabricationMs: 52,215 ms`, `heapDelta: 176,618 MiB`.
  - `benchmark:v08` (10.000 ocorrências): `importMs: 281,893 ms`, `catalogMs: 32,481 ms`, `layoutMs: 30,607 ms`, `sixPoseUpdatesMs: 63,712 ms`, `filterMs: 48,920 ms`, `annotationModelMs: 8,384 ms`, `heapDelta: 117,609 MiB`.
- **Benchmark GPU reproduzido no navegador (`test:v08` com `GEOGEN_V08_GPU=1`, Chrome SwiftShader):**
  - `100` peças: carga + knolling `353 ms`, `101` draw calls, `39 FPS` (`4 FPS` com callouts ligados).
  - `1.000` peças: carga + knolling `401 ms`, `1.001` draw calls, `42 FPS` (`4 FPS` com callouts ligados).
  - `10.000` peças: carga + knolling `813 ms`, `10.001` draw calls, `120.000` triângulos, `32 FPS` em movimento simples → **`2 FPS` com overlay de callouts ligado**.

Screenshots comparativos arquivados em [docs/v09/evidence/before/](docs/v09/evidence/before/).

---

## 2. Achados por Prioridade (P0–P3)

### P0 — Impeditivos para V1.0 / Maturidade do Produto

1. **Identidade visual e favicon inconsistentes:**
   - `geogenviewer/app/page.tsx` exibia badge fixo `v0.6` apesar de o projeto estar na `v0.8.0` (e rumo à `v0.9.0`), além de `"v0.4"` hardcoded em `ExplodePanel`.
   - `geogenviewer/app/favicon.ico` permanecia o ícone padrão do template Next.js (junto com SVGs residuais `next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg` em `public/`). Falta o símbolo triangular azul (`#3B82F6`) alinhado à família visual do portfólio.
2. **Ausência de organização personalizada em modelos GLB-only e sem camadas/grupos:**
   - Em `StructureContent` (`viewer-panels.tsx`), as abas `Camadas` e `Grupos` exibiam apenas texto estático vazio em arquivos GLB básicos ou sem grupos no manifesto, impedindo o usuário de agrupar e classificar peças no navegador.
3. **Navigation Cube com leitura diagramática fraca:**
   - `navigation-cube.tsx` desenhava `<span>` de 1 px e pequenos pontos quadrados/circulares sobrepostos (`SU`, `FR`, `DI`), lembrando um grafo de conectividade e não um objeto tridimensional sólido com faces contrastadas, arestas e vértices claros.
4. **Custo crítico de renderização em cenas repetidas e overlay de callouts:**
   - `10.000` ocorrências da mesma malha geravam **`10.001` draw calls** no Knolling e `20.000` na comparação V0.7 porque cada ocorrência permanecia um `THREE.Mesh` separado em vez de usar `InstancedMesh`.
   - Ativar callouts em `10.000` itens derrubava o FPS para **`2 FPS`** por recriar inversas `Matrix4` em `annotationModel` (`makeCallout` para 10k itens) e executar centenas/milhares de chamadas não cacheadas de `measureText` no Canvas 2D por quadro.

### P1 — Problemas Importantes de UX, Arquitetura e Robustez

5. **Home excessivamente enxuta para um software maduro:**
   - A home atual (`app/page.tsx`) consiste em um único card central sobre grade vazia, sem biblioteca de demonstrações, prévia geométrica arquitetônica, histórico leve de projetos recentes, documentação acessível ou cabeçalho institucional completo.
6. **Navegação entre 8 workspaces pouco evidente:**
   - O seletor atual no `ViewerTopbar` é um `<select>` isolado sem agrupamento visual em famílias (*Visualização*, *Inspeção*, *Análise*, *Documentação*) nem atalhos ou busca na Command Palette para alternância rápida de workspaces, vistas e organização.
7. **Falta de ações de organização no Inspector (especialmente seleção múltipla) e menu contextual:**
   - Seleção única não possui seções recolhíveis organizadas por contexto; seleção múltipla não permite criar grupo/camada, comparar atributos comuns vs. divergentes ou consultar resumo granular sem sair do painel. Falta menu contextual (botão direito + acionador explícito para touch) sobre peças e linhas da árvore.
8. **Configurações fragmentadas e ausência de cancelamento explícito de carga:**
   - Opções de aparência, unidades, qualidade, navegação/cubo e dados estão espalhadas entre popovers ou sem UI consolidada. O carregamento local em `viewer.tsx` suporta prevalência por token, mas não oferece botão explícito de cancelamento via `AbortController` na UI.
9. **Custo de CPU em buscas no Catálogo e atualização de matrizes no Knolling:**
   - `projectSearch` (`catalog.ts`) reconstrói e normaliza strings de todas as ocorrências a cada consulta (vs. `WeakMap` já usado em `visibility.ts`); `KnollingPose.apply()` recalcula `reset()` completo e inverte matriz do pai a cada componente mesmo sob o mesmo grupo pai.

### P2 — Refinamentos Desejáveis

10. **Densidade de ferramentas em viewport estreita (`390×844` e `768×1024`):**
    - Em smartphone (`10-smartphone.png`), a barra `.gg-v05-tools` quebra em duas linhas com o indicador `Perspectiva` abaixo e o botão `Inspeção espacial` colapsado; o `ExplodePanel` ocupa grande altura em retrato e botões laterais da toolbar inferior podem exigir melhor sinalização/agrupamento.
11. **Truncamento de árvore e indicação de proveniência:**
    - IDs longos na árvore (`gg-tree-id`) precisam manter truncamento controlado sem comprimir o nome da peça nem ocultar acesso ao texto completo.
12. **Modo para modelos grandes (Large Model Mode):**
    - Detectar automaticamente cenas densas por triângulos, ocorrências, materiais e malhas (não apenas tamanho em bytes), reduzindo efeitos custosos e sugerindo ajustes não bloqueantes.

### P3 — Backlog (Fora do Escopo Imediato ou Homologações Externas)

13. Homologação física em tablet real iPad/Android.
14. Execução e validação prática do `GeoGenExporter` no Rhino 8 real.
15. Testes com o arquivo autorizado da Casa Gerassi fora de fixtures sintéticas.
16. Motor próprio de PDF multipágina e cálculo de PCA exato (adiados desde a V0.8).

---

## 3. Auditoria por Workspace (V0.1–V0.8)

| Workspace | Pontos fortes preservados | Melhorias direcionadas V0.9 |
|---|---|---|
| **Explorar** | Árvore virtualizada, seleção sincronizada, isolamento com backup de estado, Quad View com 1 contexto | Novo Navigation Cube 3D, menu contextual, grupos/camadas personalizadas, instancing automático |
| **Explodir** | 4 modos sem deriva, convenção CAD Z-up, linhas de referência em `LineSegments` único | Remoção de badge `v0.4`, integração com camadas/grupos personalizados no escopo/granularidade |
| **Montagem** | Timeline determinística, editor validado 1.0.0, preservação do GLB/SHA | Navegação por famílias no topbar, acesso rápido via Command Palette |
| **Inspecionar** | Cortes em 3 eixos, snapping, medições com proveniência, PNG técnico | Alternativas acessíveis consistentes, manutenção rigorosa com instancing/clipping |
| **Comparar** | Alinhamento por origem CAD/manual, diff em repouso, resolução manual de ambiguidades | Redução drástica de draw calls via instancing nas duas revisões; proteção ao transportar organização personalizada |
| **Quantitativos** | Contagem por ocorrência, cobertura e métodos separados (teórica/slicer/medida/estimada) | Agrupamento por grupos/camadas personalizadas sem duplicar totais globais |
| **Knolling** | Muito apreciado pelo usuário: 5 layouts, 3 planos CAD, fixação e retorno exato | Preservação integral do motor; suporte a `userLayer`/`userGroup`; otimização de poses e overlay de callouts |
| **Catálogo** | Muito apreciado: busca, miniaturas em fila com cache no renderer, fichas A4/A3 e manual | Cache de busca via `WeakMap`, cards mais nítidos, filtro/escopo por organização do usuário, identidade visual centralizada |
