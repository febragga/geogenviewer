# GeoGenViewer V0.9 — Especificação do Cubo de Navegação 3D

**Arquivos:**
- Matemática pura e projeção: `geogenviewer/src/lib/geogen/domain/nav-cube.ts`
- Componente interativo SVG + controles auxiliares: `geogenviewer/src/features/viewer/components/navigation-cube.tsx`
- Integração com câmeras e rotação 90°: `geogenviewer/src/features/viewer/scene/viewport-cameras.ts` e `state/presentation-store.ts`

---

## 1. Arquitetura Técnica (Contexto WebGL Único)

Em vez de criar um segundo `<canvas>` WebGL (o que duplicaria contextos GPU e violaria o orçamento de contexto único nos testes V0.5–V0.9), o Cubo de Navegação 3D usa:

- **Projeção matemática exata** do poliedro chanfrado sólido em tempo real sincronizada pelo evento `geogen-camera-frame` emitido pela viewport ativa.
- **SVG vetorial com algoritmo do pintor** (ordenação back-to-front por profundidade `depth` do centroide em espaço de câmera).
- **Zero perda de foco ou contexto WebGL** em modos Único, Horizontal, Vertical e Quatro Vistas (*Quad View*).

---

## 2. Geometria Sólida Chanfrada (26 Estações Estáveis)

O poliedro utiliza raio externo `OUTER = 1.0` e meia-largura interna `INNER = 0.64`:

| Tipo | Quantidade | `kind` | Elementos |
|---|---|---|---|
| Faces principais ortogonais | 6 | `1` | `SUP`, `INF`, `FRT`, `POS`, `ESQ`, `DIR` |
| Chanfros de aresta | 12 | `2` | Combinações de 2 eixos (ex.: `Superior · Frontal`) |
| Chanfros de canto | 8 | `3` | Vértices isométricos de 3 eixos (ex.: `Direita · Superior · Frontal`) |

- **Iluminação direcional:** Produto escalar entre a normal transformada da face e a luz direcional `(-0.32, 0.58, 0.74)` calcula `--gg-cube-shade` para dar volume tridimensional real tanto no tema claro quanto no escuro.
- **Rotulação em perspectiva/ortográfica no plano da face:** Cada face principal possui base tangente `(tangentU, tangentV)` compatível com `viewUp(normal)` da câmera (`camera-state.ts`). O texto SVG recebe matriz afim 2D `matrix(a b c d e f)` para acompanhar o plano da face sem inversões.

---

## 3. Convenção de Eixos e Controles Auxiliares

- Segue o sistema de visualização **Y-up** adotado pelo pipeline glTF/Three.js do GeoGenViewer (conversão Z-up de Rhino/CAD documentada no `EXPORTER_CONTRACT.md`).
- **Clique/Toque em qualquer face/aresta/canto:** Orienta suavemente a viewport ativa via `access.direction(vector)`.
- **Arrasto direto sobre o cubo (> 5 px):** Executa órbita contínua em torno do alvo sem acionar clique acidental.
- **Barra auxiliar abaixo do cubo:**
  1. `Vista inicial` (`Home`): restaura orientação perspectiva inicial ajustada aos limites da cena (`access.home()`).
  2. `Girar 90° anti-horário` (`access.rotate90(-1)`): orbita ±90° no eixo Y em vistas laterais/perspectiva ou rotaciona o vetor `up` em vistas `Superior`/`Inferior`.
  3. `Girar 90° horário` (`access.rotate90(1)`).
  4. `Persp. / Orto.`: reflete a projeção da viewport ativa (`geogen-camera-frame`) e alterna entre projeção perspectiva e ortográfica (`access.projection(...)`).

---

## 4. Acessibilidade e Responsividade

- Camada `.gg-view-cube__hits` utiliza botões HTML nativos `<button type="button">` com `clip-path: polygon(...)` alinhado pixel a pixel com os polígonos SVG visíveis.
- Faces traseiras (`visible === false`) recebem `hidden = true` para evitar navegação por Tab em superfícies ocultas.
- Em dispositivos táteis (`@media (pointer: coarse)`), o palco amplia para `98×98 px` e a barra auxiliar cresce para `28 px` de altura sem colidir com `.gg-axes` (`inset-block-start: 148px`).
