# HANDOFF.md — Estado Atual do Projeto

**Data:** 25/11/2026  
**Branch ativa:** `feat/v0.2-v0.3-import-pipeline` (ramificada a partir de `feat/viewer-bootstrap`, commit `cf32e33`)  
**Responsável pelas decisões:** Fernando Braga

## 1. Resumo da Sprint 03 (V0.2 + V0.3)

As etapas **V0.2 (Interação Geométrica)** e **V0.3 (Pipeline de Importação e Contrato do Exportador)** foram implementadas e validadas, preservando o design system editorial, o tema claro/escuro em `light-dark()`, os primitivos `@base-ui/react` + `vaul` + `cmdk` + `react-resizable-panels` e zero violações no `axe-core`.

### Entregável prioritário para o exportador externo (ChatGPT Web / Rhino 8)

Pasta autocontida em `exporter-contract/`:
- `exporter-contract/EXPORTER_CONTRACT.md`
- `exporter-contract/DATA_SCHEMA.md`
- `exporter-contract/FORMAT_COMPARISON.md`
- `exporter-contract/manifest.schema.json` (JSON Schema Draft 2020-12)
- `exporter-contract/manifest.example.json`
- `exporter-contract/model.example.glb` (SHA-256 `d410ee9c444ce67d7748bb6b5626ce677583392f3dca3e19f3aa74c5d36eb8d2`)

Cópias de demonstração acessíveis diretamente pela interface `/viewer`:
- `geogenviewer/public/demos/contrato-exemplo.glb`
- `geogenviewer/public/demos/contrato-exemplo.manifest.json`

## 2. O que foi implementado

1. **Domínio, validação e importação (`geogenviewer/src/lib/geogen/`):**
   - `domain/model.ts`: modelo de domínio serializável (`ManifestV1`, `ViewerSceneGraph`, `ComponentRecord`, `LayerRecord`, `GroupRecord`, `computeVisibilityState`).
   - `validation/manifest.ts`: validação executável via `ajv` (`schemas/manifest-v1.schema.json`) + validações semânticas (SemVer major/minor, finitude numérica, bloqueio de HTML/script, IDs únicos, ciclos, referências quebradas, `isClosed: false` com `volumeM3: null`, ordem de dependências de montagem).
   - `importers/package.ts`: `importGlbBasicPackage`, `importGlbWithManifestPackage`, `sha256Hex`, vínculo estrito por `extras | nameExact | namePrefix`, desambiguação diagnóstica no modo básico, compósitos multi-malha e instâncias compartilhadas.

2. **Estado e árvore (`geogenviewer/src/features/viewer/`):**
   - `state/viewer-store.ts`: store `zustand` v5.1.0 apenas com IDs e grafo serializável (seleção única/múltipla, hover, ocultar/mostrar/isolar/mostrar tudo, expandir/recolher, abas, busca, multi-seleção).
   - `tree/build-rows.ts`: construção pura da árvore para `Componentes`, `Camadas` e `Grupos` com filtragem preservando ancestrais.
   - `components/viewer-panels.tsx`: árvore interativa com virtualização automática acima de 100 linhas, estados de visibilidade (`visible`, `hidden`, `partial`), enquadramento por item e painel de propriedades com proveniência explícita (`Malha`, `CAD`, `Manifesto`).

3. **Viewport 3D e UI (`geogenviewer/src/features/viewer/`):**
   - `scene/viewport.tsx`: picking por raycasting diferenciando arraste de clique/toque (`< 6px`, ignora gesto multi-toque), hover em mouse, destaque não destrutivo com descarte de materiais temporários, controle de visibilidade por renderizável e enquadramento de seleção (`targetIds`).
   - `viewer.tsx`, `components/viewer-topbar.tsx`, `components/viewer-toolbar.tsx`, `components/command-palette.tsx`, `copy.ts`, `components/icons.tsx`, `app/globals.css`: entrada dual `.glb` + `.json` (arquivo múltiplo e drag-and-drop), botão/demo `Demo GLB + JSON`, diálogo de escolha explícita quando o manifesto falha (sem fallback silencioso), barra e atalhos (`H`, `I`, `A`, `F`, `R`, `Esc`) mantendo ferramentas `v0.4`/`v0.6` desabilitadas.

4. **Documentação e benchmark adicionados:**
   - `IMPORT_PIPELINE.md` e `PERFORMANCE_REPORT.md` na raiz do repositório.
   - `geogenviewer/scripts/generate-contract-example.mjs`, `geogenviewer/scripts/benchmark-scenes.mjs`, `geogenviewer/tests/v02-v03.test.mjs`.

## 3. Verificações Executadas

- `npm --prefix geogenviewer run typecheck`: aprovado (`0` erros; `"allowImportingTsExtensions": true` habilitado em `tsconfig.json` para compartilhar imports `.ts` com Node `--experimental-strip-types`).
- `npm --prefix geogenviewer run lint`: aprovado (`0` erros, `0` warnings).
- `npm --prefix geogenviewer test`: **7/7 testes aprovados** (`glb.test.mjs` + `v02-v03.test.mjs`).
- `node --experimental-strip-types geogenviewer/scripts/benchmark-scenes.mjs`: 100 / 1.000 / 10.000 componentes medidos (import completo + SHA-256 em 170,43 ms e achatamento de árvore em 4,50 ms para 10.000 peças; ver `PERFORMANCE_REPORT.md`).
- `npm --prefix geogenviewer run build`: build de produção Next.js aprovado (`/`, `/_not-found`, `/viewer`).
- `npm --prefix geogenviewer run test:ui` (Playwright + Chrome headless SwiftShader + `@axe-core/playwright`): aprovado em desktop dark/light (`1440×900`), tablet (`1024×768` e `768×1024`) e smartphone (`390×844`) com `0` erros de console/página, `0` requisições externas, carregamento e inspeção de `contrato-exemplo.glb + .manifest.json`, teste de manifesto inválido + fallback explícito e **`0` violações `axe-core`**.

## 4. Limitações Conhecidas e Próximo Passo

- `benchmark-scenes.mjs` mede CPU/importação/estrutura no Node.js; medições com 10.000 draw calls reais em WebGL dependem da GPU do dispositivo alvo.
- Não foi realizado push nem merge na `main` sem autorização explícita do responsável.
- **Próximo passo recomendado (V0.4):** implementar vista explodida (`explodeOffsetM` já reservado em `ManifestV1`), leitura real do protótipo da Casa Gerassi quando exportado pelo `GeoGenExporter` v1.0 e refinamento de métricas/instanciamento conforme o modelo real.
