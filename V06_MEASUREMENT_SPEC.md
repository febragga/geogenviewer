# V0.6 — motor de medições

## Grandezas

- **Distância** usa `||B − A||₂` em metros.
- **Delta XYZ** guarda as diferenças em eixos CAD com transformação inversa `(x, y, z) → (x, −z, y)`.
- **Coordenadas** usa eixos CAD relativos à origem local. Quando origem, orientação e escala da exportação estão disponíveis, apresenta também a coordenada no sistema de origem do documento.

O motor calcula em dupla precisão JavaScript sobre os vértices disponíveis na malha glTF. O arredondamento ocorre na interface. A unidade do projeto determina a apresentação em milímetros, centímetros ou metros. A distância de uma peça de 100 mm em uma maquete 1:50 permanece 100 mm. O equivalente de 5.000 mm aparece separadamente como **Derivada** quando aplicável.

## Referências e pose

O ponto persistente combina ID do componente, índices de descendência a partir do seu nó, coordenada local em metros e ID de instância quando necessário. O modelo e a revisão são associados ao SHA-256 binário quando disponível. O importador valida a identidade, a existência da referência e se o ponto está dentro de uma tolerância da envolvente local. A verificação de envolvente é uma validação estrutural da referência. A garantia de que um ponto adquirido está sobre a malha vem do raycast ou do snap.

O controlador mantém as matrizes de repouso em memória. Em **Original**, o cálculo usa essas matrizes. Em **Apresentação**, usa matrizes da pose temporária na confirmação. A cota na cena acompanha a geometria atual em ambos os casos, com o valor original ou com o valor da pose atual identificado no rótulo. A lista mantém o valor registrado e o instantâneo técnico atualiza os valores de apresentação para o instante capturado. Peças ocultas, recortadas ou ainda não montadas suprimem a anotação na região afetada.

## Snap

O motor usa a face trazida pelo primeiro hit elegível. Converte seus três vértices ao espaço mundial, com matriz de instância quando aplicável. Testa vértice, meio da aresta e aresta em ordem de prioridade e verifica a distância em pixels da região. Na projeção perspectiva, a interpolação no segmento usa as coordenadas homogêneas para recuperar o ponto 3D correspondente. A superfície é alternativa quando habilitada. Shift ignora os encaixes temporariamente. O picking considera os planos de corte e aplica a mesma política aos candidatos.

## Proveniência

| Fonte | Aplicação |
|---|---|
| CAD | Valores do exportador identificados no manifesto |
| Malha | Distâncias, deltas e coordenadas adquiridos sobre o GLB |
| Autoral | Dados inseridos pelo autor e registrados com essa origem |
| Derivada | Conversão separada a partir da escala declarada |

O Inspector compara envolventes de repouso alinhadas aos eixos quando o manifesto contém AABB de proveniência CAD e a malha possui extensão correspondente. A diferença absoluta usa a unidade indicada e o percentual usa a extensão CAD como denominador. Dimensões orientadas de fabricação têm semântica distinta.

A tolerância de tesselação é desconhecida com o contrato atual. A fixture sintética usa tolerância numérica de 0,002 mm nos testes e folga geométrica nominal de 0,13 mm por lado no encaixe. O ensaio verifica a representação armazenada. Ângulos, polilinhas e snaps de entidades NURBS ficam fora da entrega.
