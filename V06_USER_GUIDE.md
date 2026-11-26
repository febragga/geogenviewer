# GeoGenViewer V0.6 — guia de inspeção

Abra `/viewer?demo=inspecao` no ambiente local ou escolha **Laboratório de inspeção** no menu do viewer. O laboratório é sintético e inclui cubo de 100 mm, superfícies abertas e fechadas, encaixes e instâncias. Um pacote GLB + manifesto compatível ou um GLB autocontido também pode ser inspecionado.

## Cortar

1. No workspace **Inspecionar**, abra **Inspeção espacial** e selecione **Cortes**.
2. Escolha **X**, **Y** ou **Z** e marque **Ativar corte**. Z corresponde ao corte horizontal.
3. Ajuste o slider, digite a posição e pressione Enter ou arraste o manipulador na viewport. As setas do teclado também movem o manipulador quando ele tem foco.
4. Use a inversão para trocar o lado preservado. Escolha entre seção aberta, contorno, preenchida e técnica.
5. Em layouts múltiplos, use **Compartilhar cortes entre vistas** para sincronizar. Desmarque para manter ajustes separados por região. A árvore, o picking e as cotas respeitam os cortes da vista ativa.

A posição usa a unidade de exibição do projeto e a origem local. Os atalhos de centro e limites da seleção usam as envolventes de repouso. **Enquadrar região visível** ajusta a câmera à envolvente limitada pelos cortes.

## Medir

Em **Medir**, escolha **Distância**, **Delta XYZ** ou **Coordenadas**. Clique ou toque diretamente na peça. Distância e delta usam dois pontos. A prévia apresenta o candidato e o tipo de snap. Shift mede na superfície durante o clique. Esc cancela a medida incompleta e preserva a seleção. Os encaixes usam vértices e arestas da malha.

Escolha **Original** para medir a geometria no repouso, ou **Apresentação** para medir a pose atual em Explodir ou Montagem. A lista permite renomear, ocultar, excluir, trocar a pose e enquadrar as referências. Valor, unidade, método e proveniência aparecem no registro. Use o painel **Propriedades** para consultar as medidas CAD e autorais disponíveis.

## Guardar e documentar

- Em **Vistas**, dê um nome à configuração e salve para recuperar câmera, layout, filtros, cortes e medições visíveis. Vistas da V0.5 continuam acessíveis.
- Em **Captura**, escolha resolução e fundo. Controle a inclusão de cotas, IDs, eixos, grade, seleção e manipuladores. O PNG usa a vista ativa. A régua gráfica é ortográfica.
- **Baixar JSON de inspeção** guarda cortes, medições e dados de captura. **Baixar metadados da última captura** guarda o estado registrado junto ao PNG mais recente. Para abrir, carregue primeiro o mesmo modelo e depois use **Importar JSON de inspeção**.
- O navegador guarda automaticamente a inspeção por projeto, revisão e identidade binária quando disponível. Para experimentar registros prontos, importe [o JSON do laboratório](geogenviewer/public/demos/inspection-lab.inspection.json).

Os PNGs documentam inspeção do modelo tessellado. A precisão de fabricação e a escala física de impressão exigem validação específica.
