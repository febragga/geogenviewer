# GeoGenViewer V0.9 — Relatório de Acessibilidade (WCAG 2.1 AA)

**Versão:** v0.9.0 · **Ferramenta Automatizada:** `@axe-core/playwright` (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`)

---

## 1. Cobertura e Verificações Automatizadas

Todas as suítes E2E (`test:ui`, `test:v05`, `test:v06`, `test:v07`, `test:v08`, `test:v09`) executam auditorias `axe-core` em fluxos interativos e múltiplos tamanhos de tela.

### Correções de Acessibilidade Aplicadas durante a V0.9
1. **`label-content-name-mismatch` no link da marca (`viewer-topbar.tsx`):** A pill `v0.9.0` foi movida para fora do elemento `<Link>` para manter o texto visível (`GeoGenViewer`) estritamente alinhado ao `aria-label`.
2. **`label-content-name-mismatch` no controle de projeção (`navigation-cube.tsx`):** O `aria-label` passou a iniciar pelo texto visível exibido no botão, mantendo descrição clara para leitores de tela.
3. **Semântica do Cubo de Navegação 3D (`navigation-cube.tsx`):**
   - Cada estação visível possui botão HTML `<button type="button">` com caixa de colisão alinhada ao polígono projetado.
   - Faces voltadas para trás recebem `hidden = true` para evitar paradas de `Tab` em faces ocultas.
4. **Diálogos modais nativos (`ControlsDialog`, `SettingsDialog`, confirmação de exclusão de camada):**
   - Utilizam `<dialog>` com `.showModal()`, travamento de foco nativo, fechamento por `Escape`, clique em backdrop e `overscroll-behavior: contain`.
5. **Ergonomia tátil (`@media (pointer: coarse)`):**
   - Alvos mínimos elevados (`44 px`), botão dedicado `⋮` para menu de contexto em telas sem clique direito, e largura adaptada sem overflow horizontal (`scrollWidth <= innerWidth`) em `390×844` e `768×1024`.

---

## 2. Limitações Declaradas

- Testes automatizados de browser cobrem Chrome desktop e emulação tátil (`1024×768`, `768×1024`, `390×844`) via Playwright; não substituem verificação com leitor de tela nativo e hardware tablet/smartphone físico (ver `V09_TEST_REPORT.md`).
