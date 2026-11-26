# V0.7 — comparação geométrica

O snapshot é capturado assim que um pacote validado entra no visualizador. Ele mantém, por peça, a matriz mundial de repouso, geometria original e a transformação relativa de cada malha de propriedade direta. A matriz relativa preserva hierarquias, blocos, escalas não uniformes e espelhamento. Explosão, montagem e câmera ficam fora do cálculo.

A primeira etapa compara assinaturas determinísticas dos triângulos locais com seus vértices ordenados. A assinatura tolera reordenação de índices e triângulos e desconsidera normais e orientação de faces. Se divergir, o motor mede a diferença das caixas locais e busca divergências bilaterais de distância ponto-triângulo. A amostra inclui vértices e centroides de até 64 faces por sentido. O limite de 120 mil verificações reduz o custo no navegador. A verificação devolve resultados de triângulos idênticos, malhas diferentes com amostras dentro da tolerância, divergência acima da tolerância ou comparação inconclusiva.

O limite padrão é 0,1 mm. A interface apresenta a tolerância na unidade de exibição do projeto. A tolerância de fabricação pertence aos metadados da peça e é comparada em campo próprio. Malhas de tesselação diferente podem ultrapassar o limite em superfícies curvas. A cobertura da amostragem é finita, e os vértices GLB usam precisão float32. Para NURBS, a análise descreve a representação de malha disponível. A transformação gravada no vértice pelo exportador fica incorporada à forma local.

As matrizes de repouso são decompostas em posição, quaternion e escala. A comparação aplica tolerância linear de geometria à posição, 1e-5 rad à rotação e 1e-7 à distância entre escalas. A matriz reconstruída é conferida antes de interpretar rotação e escala. Cisalhamento e singularidade geram indicação de inconclusão.

A comparação visual de materiais usa propriedades escalares, cor, nomes e presença de mapas. A igualdade do conteúdo binário de texturas requer uma análise específica.

## Alinhamento

Cada origem de exportação é convertida para metros canônicos. Para origem Z-up a conversão segue `[x,z,-y]`; para Y-up usa os eixos declarados. A translação de origem é `origem B − origem A`. As malhas permanecem em metros e Y-up, e a análise opera em torno da origem local A. O modo exige o mesmo projeto com origem, unidade, eixo e tipo de geometria conhecidos e escala compatível.

O usuário pode adicionar uma translação na unidade de exibição e uma rotação XYZ em torno da origem local de B. A rotação afeta a posição e orientação de B e os controles de reset restauram os parâmetros padrão. Projetos com escalas físicas diferentes continuam nas dimensões modeladas. Alinhamento por pontos e comparação normalizada por escala ficaram fora desta entrega.
