# GeoGenViewer V0.9 — Relatório de Testes e Evidências

**Versão:** v0.9.0 · **Data:** 26/11/2026

---

## 1. Matriz de Verificação Executada

Todos os comandos abaixo foram executados após a última alteração de código (`globals.css`, `navigation-cube.tsx`, `viewer.tsx`) com **código de saída 0**:

| Verificação | Comando | Resultado Observado |
|---|---|---|
| Lint | `npm --prefix geogenviewer run lint` | `0` erros, `0` warnings |
| TypeScript | `npm --prefix geogenviewer run typecheck` | `0` erros |
| Testes unitários e domínio | `npm --prefix geogenviewer test` | **`62 / 62` aprovados** (55 existentes + 7 novos em `tests/v09-product-design.test.mjs`, `1076,37 ms`) |
| Build de produção | `npm --prefix geogenviewer run build` | Compilado com sucesso (Next.js 16.4.6 Turbopack; rotas `/`, `/viewer`, `/icon.svg`, `/apple-icon.png`, `/manifest.webmanifest`) |
| Auditoria UI (Home + Viewer + Explode) | `npm --prefix geogenviewer run test:ui` | `0` erros de console/página, `0` requisições externas, `0` overflow em `1440×900`, `1366×768`, `768×1024`, `390×844`; **`0` violações `axe`** em `home`, `viewerDark`, `viewerLight`, `explodeLight` |
| Regressão V0.5 (Câmeras, Quad, Filtros, Montagem) | `npm --prefix geogenviewer run test:v05` | Passou em todas as 7 medições (`1440×900`, `1920×1080`, `modo limpo`, `1280×800`, `1024×768 · touch`, `768×1024 · touch`, `390×844 · touch`), `clipped: []`, `toolbarOverflow: 0`, `Draw calls: 24` (single) / `96` (quad), `0` violações `axe` |
| Regressão V0.6 (Clipping e Medições) | `npm --prefix geogenviewer run test:v06` | Passou em 6 resoluções (`overflow: 0`, `popupFits: true`), `pavilionSingle: 24`, `pavilionQuad: 96`, `0` violações `axe` |
| Regressão V0.7 (Comparação e Quantitativos) | `npm --prefix geogenviewer run test:v07` | Passou em 6 resoluções, exportações CSV/JSON/PNG validadas, clipping verificado, `0` violações `axe` |
| Regressão + Benchmark GPU V0.8 | `GEOGEN_V08_GPU=1 npm --prefix geogenviewer run test:v08` | Passou em 6 resoluções, `2` draw calls para `100` / `1.000` / `10.000` peças (vs `101` / `1.001` / `10.001`), `1` contexto WebGL, `0` violações `axe` |
| Suíte dedicada V0.9 | `npm --prefix geogenviewer run test:v09` | Passou em Home Dark/Light, Empty State, NavCube 3D, Quad View, Camadas/Grupos do Usuário + Undo/Redo + Modal de Exclusão, Menu de Contexto, Configurações (fundo independente), Paleta `Ctrl+K`, e 6 resoluções (`1920×1080`, `1440×900`, `1280×800`, `1024×768`, `768×1024`, `390×844`) com `0` violações `axe` e `0` erros |

---

## 2. Evidências Visuais (Antes e Depois)

- **Baseline antes da V0.9:** [`docs/v09/evidence/before/`](docs/v09/evidence/before/)
- **Capturas após a V0.9 (`test:v09`):** [`docs/v09/evidence/after/`](docs/v09/evidence/after/) (`01-home-dark.png` a `15-command-palette.png`)
- **Resumo estruturado JSON:** [`geogenviewer/test-results/v09/verify-v09.json`](geogenviewer/test-results/v09/verify-v09.json)

---

## 3. Pendências de Homologação Externa

- Validação manual em **tablet e smartphone físicos** (os testes acima cobriram emulação tátil no Chromium desktop).
- Execução integrada com pacotes exportados pelo **GeoGenExporter no Rhino 8 real** e com **geometria autorizada da Casa Gerassi**.
