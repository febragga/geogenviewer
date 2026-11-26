# EXPLODED_VIEW_TEST_GUIDE.md — Guia de Testes e Validação da Vista Explodida (V0.4)

**Data:** 25/11/2026  
**Branch:** `feat/v0.4-exploded-view`

---

## 1. Comandos de Verificação Automatizada

```powershell
# 1. Verificação estática (TypeScript + ESLint)
npm --prefix geogenviewer run typecheck
npm --prefix geogenviewer run lint

# 2. Suíte unitária e de integração geométrica (13 testes: glb + v02-v03 + v04-explode)
npm --prefix geogenviewer test

# 3. Benchmarks sintéticos de escala (100 / 1.000 / 10.000 componentes)
node --experimental-strip-types geogenviewer/scripts/benchmark-scenes.mjs
node --experimental-strip-types geogenviewer/scripts/benchmark-explode.mjs

# 4. Build de produção Next.js + auditoria visual / Playwright / axe-core
npm --prefix geogenviewer run build
npm --prefix geogenviewer run test:ui
```

---

## 2. Cobertura dos Testes Automatizados (`geogenviewer/tests/v04-explode.test.mjs`)

| Caso testado | O que valida |
|---|---|
| Convenção CAD → glTF | `cadAxisToGltf("Z")` resulta `(0, 1, 0)` e `cadAxisToGltf("Y")` resulta `(0, 0, -1)`. |
| Fator zero e repetição | Retorno de `1.4 → 0.6 → 0` restaura posições originais com erro `< 1e-9`; 20 aplicações repetidas não acumulam deriva. |
| Compósitos e instâncias | Sub-malhas internas da escada/viga composta mantêm posições relativas; conectores compartilhados mantêm geometria única e IDs distintos. |
| Grupos sobrepostos | Na granularidade `group`, `vg-composta-central` (presente em múltiplos grupos) desloca-se exatamente uma vez. |
| Escopo e visibilidade | `scope: "selection"` move apenas selecionados; peças ocultas/isoladas zeram seus segmentos em `writeReferenceSegmentsBuffer`. |
| Raycasting pós-explosão | `Raycaster` sobre o componente explodido resolve o mesmo ID lógico. |
| Reset na troca de modelo | `useViewerStore.setSceneGraph(...)` limpa `explode.factor`, `enabled`, `explodeTransition` e `explodedBoundsMeters`. |
| Compatibilidade básica e v1.0.0 | Funciona em `estrutura.glb` (sem manifesto) e `contrato-exemplo.glb` + `manifest.example.json`. |
| Casos degenerados | Hierarquia aninhada 4 níveis sob escala não uniforme `[2, 0.5, 3]`, modelo a `[10000, 0, 10000]`, peças coincidentes separadas por fallback determinístico, modelo vazio e espessura zero. |

---

## 3. Roteiro de Validação Manual no Navegador (Desktop e Tablet Touch)

1. Abrir `/viewer?demo=pavilhao` (carrega o Pavilhão Estrutural Sintético de 18 peças).
2. Clicar em **Explodir** (`E`) na barra inferior e arrastar o slider até ~`45%` e `100%`:
   - Verificar abertura do painel flutuante sem obstruir o centro do modelo.
   - Confirmar no painel direito (`Propriedades`) que surgem `Envolvente original (modelo)` e `Envolvente explodida (visual)` com o badge `Visualização temporária`.
3. Alternar modos **Radial**, **Axial (X / Y / Z CAD)**, **Direcional** e **Hierárquica**, testando escopo (`Modelo completo`, `Selecionados`, `Camada`, `Grupo`) e granularidade (`Por componente`, `Por camada`, `Por grupo`).
4. Clicar em uma peça explodida na cena (e pela árvore), ocultar (`H`), isolar (`I`), enquadrar (`F`) e confirmar que a seleção continua destacando a peça deslocada corretamente e `Mostrar tudo` (`A`) restaura a visibilidade.
5. Alternar o botão **Linhas de referência** e os temas **Claro / Escuro**.
6. Clicar em **Animar explosão**, interromper no meio clicando em **Pausar animação** e clicar em **Restaurar (0%)** confirmando retorno exato da montagem.
7. Testar via Chrome DevTools (ou tablet físico quando disponível) nos viewports `1440×900`, `1366×768`, `1024×768`, `768×1024` e `390×844`.
