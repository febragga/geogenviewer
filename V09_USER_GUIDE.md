# GeoGenViewer V0.9 — Guia do Usuário

**Versão:** v0.9.0 · **Aplicação:** `/viewer` e `/` (Home Launchpad)

---

## 1. Começando na Home

1. Acesse a tela inicial para ver o **Showcase Interativo** (*Montado*, *Explodido* e *Knolling*), abrir qualquer uma das **6 demonstrações** ou retomar um dos **Projetos Recentes** da sessão local.
2. Clique em **Abrir modelo local** para carregar um `.glb` avulso ou um par `.glb + .json` exportado pelo **GeoGenExporter** no Rhino 8. Todo processamento ocorre localmente no seu navegador; durante o carregamento é possível clicar em **Cancelar** na pílula de progresso.

---

## 2. Navegação 3D e Cubo de Orientação

- **Órbita / Pan / Zoom:** Use o mouse (`botão esquerdo` órbita, `direito/Ctrl` pan, `roda` zoom) ou toques no tablet (1 dedo órbita, 2 dedos pan/zoom), alternáveis na toolbar inferior.
- **Cubo de Navegação 3D (canto superior direito):**
  - Clique em **faces** (`SUP`, `FRT`, `DIR`, `ESQ`, `POS`, `INF`), **arestas** ou **cantos** para alinhar instantaneamente a câmera.
  - **Arraste** diretamente sobre o cubo para orbitar continuamente.
  - Use a barra auxiliar abaixo do cubo para **Vista Inicial (`Home`)**, **Girar 90° (`↺`/`↻`)** e alternar **Perspectiva / Ortográfica (`Persp.`/`Orto.`)**.
- **Múltiplas vistas (`Vistas`):** Alterne entre vista única, lado a lado, empilhada ou **Quatro vistas (*Quad View*)**, salve vistas personalizadas e exporte PNG.

---

## 3. Workspaces Organizados em 4 Famílias

Na barra superior, alterne rapidamente entre:

1. **Visualização:** `Explorar`, `Explodir` (vista explodida radial/axial/hierárquica), `Montagem` (reprodução passo a passo com peças futuras em transparência).
2. **Inspeção:** `Inspecionar` (planos de corte X/Y/Z com cap em tempo real e medições ponto-a-ponto com snap).
3. **Análise:** `Comparar` (diff lado a lado, sobreposto ou alternado entre duas revisões) e `Quantitativos` (tabelas virtualizadas, custos e exportação CSV/JSON).
4. **Documentação:** `Knolling` (5 modos automáticos nos planos XY/XZ/YZ com posições fixáveis) e `Catálogo` (cartões, miniaturas, callouts e fichas técnicas A4/A3 para impressão).

---

## 4. Camadas e Grupos do Usuário

1. No painel **Estrutura** (`[`), abra as abas **Camadas** ou **Grupos** e selecione **Personalizada**.
2. Clique em **+ Camada** / **+ Grupo** para criar sua própria hierarquia, ou **Copiar CAD** para clonar a estrutura importada sem modificar os dados originais.
3. **Atribuir peças:**
   - Clique com o **botão direito** na peça (na cena 3D ou na árvore) ou no botão **⋮** em telas touch para abrir o menu de contexto.
   - Ou **arraste** um componente na árvore sobre uma camada/grupo do usuário, ou use os seletores rápidos no **Inspector** (`]`) inclusive em **multiseleção**.
4. **Regras:** Cada ocorrência pertence a no máximo **uma camada direta do usuário**, mas pode participar de **múltiplos grupos sobrepostos**. Ao excluir uma camada com peças, escolha mover as ocorrências para a camada superior ou apenas remover a atribuição.
5. Use **Desfazer/Refazer**, **Exportar/Importar `organization.json`**, **Filtros** (*Camadas do usuário*, *Grupos do usuário*) e **Exibição → Cor por camada**.

---

## 5. Configurações e Atalhos

- **Configurações (ícone de engrenagem no topo):** Ajuste tema (*Sistema/Claro/Escuro*), fundo independente da viewport, visibilidade do Cubo 3D, qualidade gráfica, modo automático para modelos grandes, unidades (`mm/cm/m`) e limpeza de dados locais.
- **Paleta de Comandos (`Ctrl+K` / `⌘K`):** Pesquise comandos, workspaces, vistas e camadas/grupos personalizados sem precisar memorizar menus.
- **Atalhos rápidos:** `F` enquadrar, `R` redefinir câmera, `H` ocultar seleção, `I` isolar, `A` mostrar tudo, `E` vista explodida, `[` e `]` painéis laterais.
