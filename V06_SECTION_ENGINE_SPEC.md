# V0.6 — motor de planos de corte

## Coordenadas

O estado persiste posição em metros no eixo CAD relativo à origem local. A transformação de um vetor Rhino para o Three.js é `(x, y, z) → (x, z, −y)`.

| Eixo na interface | Normal padrão em RH_Y_UP | Orientação |
|---|---|---|
| X | (1, 0, 0) | Vertical |
| Y | (0, 0, −1) | Vertical |
| Z | (0, 1, 0) | Horizontal |

Para posição `d`, o semiespaço preservado satisfaz `normal · ponto − d ≥ 0`. Inverter troca sinal da normal e da constante. A CPU admite margem de `10⁻⁸ m` para pontos na fronteira. O renderer usa a precisão dos vértices e matrizes do WebGL. A origem CAD distante é representada em metadados de origem enquanto o modelo permanece local, conforme o exportador.

## Planos e regiões

Cada região lê um conjunto de até três planos ortogonais. Compartilhar usa o conjunto da vista ativa como nova referência. Separar começa com configurações iguais que podem ser editadas independentemente. Named Views e JSON persistem os quatro conjuntos.

`InspectionScene.draw` aplica a lista de planos ao mesmo renderer durante o passe de scissor ou de captura. O bloco `finally` repõe a lista anterior e remove geometria temporária. O modelo, os materiais importados, os IDs e as matrizes de repouso pertencem ao pipeline existente. A seleção percorre os hits por distância e aceita a primeira superfície visível que satisfaz todos os planos, mesmo quando uma peça mais próxima foi cortada. O enquadramento limita a envolvente visível aos semiespaços ortogonais.

O painel oferece posição de slider e número na unidade do projeto, centro, limites de seleção, inversão, aparência e reset. O manipulador projetado converte deslocamento do ponteiro em metros. Em vista quase paralela ao eixo de deslocamento, o movimento vertical da tela mantém o controle disponível.

## Contornos e preenchimento

- **Aberta** usa clipping shader.
- **Contorno** acrescenta segmentos de interseção entre plano e triângulo.
- **Preenchida** triangula os loops fechados de geometrias com topologia orientável e fechada. Loops internos permanecem como furos. Faces tangenciais e totalmente coplanares seguem como superfícies originais.
- **Técnica** acrescenta superfícies neutras e arestas ao corte preenchido.

A validação agrupa vértices coincidentes dentro de tolerância relativa à extensão local da malha. Uma seção em malha aberta ou com junção ambígua conserva o contorno possível e sinaliza o preenchimento indisponível. O procedimento opera por malha e ocorrência, inclusive instâncias e componentes compostos. Em uma composição com primitivos cujas superfícies se sobrepõem, o corte é representado por primitivo e pode mostrar interseções entre preenchimentos.

O cache topológico usa a identidade da geometria. Até quatro combinações recentes de planos, visibilidade e pose mantêm buffers temporários reutilizáveis. A câmera, isoladamente, reaproveita o cache. Durante arraste ou animação contínua, o shader continua recortando e os contornos são restaurados após o movimento. A exportação técnica calcula o corte para a pose capturada.

O preenchimento usa um pequeno deslocamento no lado preservado para evitar conflito com o próprio plano na rasterização. Caps e contornos ficam fora da árvore de picking e dos cálculos de propriedades. O corte representa a malha tessellada.

## Extensões

A fronteira do renderer admite listas de planos arbitrários. A edição e o enquadramento desta entrega usam planos ortogonais. Section Box, planos oblíquos, hachuras e SVG de contornos ficam para uma extensão posterior.
