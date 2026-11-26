# HANDOFF.md — Estado Atual do Projeto

**Data:** 25/11/2026  
**Branch ativa:** `feat/v0.4-exploded-view` (ramificada após `6a9ab0e`)  
**Responsável pelas decisões:** Fernando Braga

## 1. Resumo da Sprint 04 (V0.4 — Vista Explodida Interativa)

A etapa **V0.4 — Exploded View Engine & Interactive Inspection** foi implementada, testada e auditada visualmente em temas claro e escuro, preservando integralmente o contrato externo v1.0.0 (`exporter-contract/`), os sistemas da V0.2/V0.3 e o design system editorial do portfólio.

### O que foi entregue

1. **Pesquisa e arquitetura (`EXPLODED_VIEW_RESEARCH.md`, `EXPLODED_VIEW_ENGINE.md`, `EXPLODED_VIEW_TEST_GUIDE.md`):**
   - Comparação técnica com CraftBot (`2d52c09288c34f8b0e95157c213c4ed883ef59eb`), Autodesk Inventor/Fusion, SolidWorks, Shapr3D, Onshape, Rhino 8, Blender e Speckle.
   - Especificação de preservação de pose de repouso, compensação de hierarquia e conversão explícita `CAD (Z-up)` → `glTF (Y-up)`.

2. **Motor de Explosão (`geogenviewer/src/lib/geogen/explode/controller.ts`):**
   - `ExplodedViewController`: captura snapshot imutável de repouso (`restLocalPosition`, `restWorldBox`, inversa linear `3×3` dos ancestrais), executando deslocamentos sem deriva acumulada nem dupla aplicação em filhos aninhados.
   - Modos implementados: **`radial`** (com detecção de clusters coincidentes e fallback determinístico pelo ângulo áureo), **`axial`** (`X`, `Y`, `Z` seguindo convenção CAD do `EXPORTER_CONTRACT.md`), **`directional`** (vetor CAD do usuário ou `explodeOffsetM`/`assemblyDirectionM` do manifesto v1.0.0) e **`hierarchical`**.
   - Separação explícita entre **Escopo** (`all`, `selection`, `layer`, `group`) e **Granularidade** (`component`, `layer`, `group`) com deduplicação de grupos sobrepostos.

3. **Integração 3D, linhas de referência e animação (`viewport.tsx`, `viewer-store.ts`):**
   - Seleção por raycasting, hover, ocultação, isolamento e enquadramento (`Fit`) operando normalmente na pose explodida; seleção retorna exatamente o mesmo ID lógico e ignora peças ocultas.
   - Linhas de referência tracejadas renderizadas em um único `THREE.LineSegments` pré-alocado (`raycast = () => {}`), adaptadas ao tema claro/escuro e à visibilidade.
   - Animação suave via R3F `useFrame` (`frameloop="demand"`) com respeito a `prefers-reduced-motion` e sem atualizar Zustand nem reconstruir a árvore por frame.

4. **Interface flutuante e modelo demonstrativo (`explode-panel.tsx`, `viewer-toolbar.tsx`, `command-palette.tsx`, `viewer-panels.tsx`):**
   - Botão **`Explodir`** (`E`) habilitado na toolbar (desktop/tablet/smartphone) abrindo popover compacto (`0.00..1.50`, presets, animação Play/Pausar/Restaurar, modos/eixos/vetor, escopo/granularidade e linhas de referência).
   - `PropertiesContent` exibe claramente **Envolvente original (modelo)** vs. **Envolvente explodida (visual)** marcada como **Visualização temporária**.
   - Demonstração estrutural sintética independente em `geogenviewer/public/demos/pavilhao-explosao.glb` e `pavilhao-explosao.manifest.json` (`18` elementos cobrindo fundação, pilares, vigas longitudinais, viga composta, lajes, escada composta, conectores instanciados e grupos sobrepostos, SHA-256 `d9ef9f869219ec0616d3a1433e412d9961f207752b1e772eb04df810dbc57e1c`).

## 2. Verificações Executadas após a Última Edição de Código

- `npm --prefix geogenviewer run typecheck`: aprovado (`0` erros).
- `npm --prefix geogenviewer run lint`: aprovado (`0` erros, `0` warnings).
- `npm --prefix geogenviewer test`: **13/13 testes aprovados** (`glb.test.mjs` + `v02-v03.test.mjs` + `v04-explode.test.mjs`, cobrindo todos os cenários da Fase J e casos degenerados).
- `node --experimental-strip-types geogenviewer/scripts/benchmark-explode.mjs`: 100 / 1.000 / 10.000 componentes medidos (preparo `35,87 ms`, atualização média `1,118 ms/frame` e linhas `0,127 ms/frame` em 10.000 peças; ver `PERFORMANCE_REPORT.md`).
- `npm --prefix geogenviewer run build`: build de produção Next.js `16.4.6` (Turbopack) aprovado (`/`, `/_not-found`, `/viewer`).
- `npm --prefix geogenviewer run test:ui`: aprovado em `1440×900`, `1366×768`, `1024×768`, `768×1024` (incluindo contexto `hasTouch`) e `390×844` nos temas claro e escuro, com `0` erros de console/página, `0` requisições externas, zero overflow e **`0` violações `axe-core`**.

## 3. Limitações e Próximo Passo (V0.5)

- A validação touch e responsiva foi realizada via emulação Playwright/Chrome; ainda requer validação em dispositivo tablet físico quando disponível.
- Não foi alterado o contrato externo (`exporter-contract/`, `manifest.schema.json`, `DATA_SCHEMA.md`, `EXPORTER_CONTRACT.md`); nenhum script Python do exportador foi escrito.
- **Próximo passo recomendado (V0.5):** implementar timeline de montagem construtiva guiada por `assembly.steps[]` + dependências (`dependsOn`), garantindo exclusividade mútua clara com a vista explodida (ambas partindo das poses de repouso imutáveis) e testes com o primeiro protótipo real da Casa Gerassi quando exportado pelo `GeoGenExporter`.
