# V0.8 — motor de knolling

O motor recebe ocorrências ou representantes de tipo e retorna caixas e matrizes temporárias de apresentação. A chave de ocorrência separa componentes, mesmo quando compartilham geometria. A malha descendente permanece com o proprietário semântico registrado pelo importador.

## Projeção e orientação

A pose de repouso fornece escala e orientação. O motor transforma as caixas locais de cada malha para a base do plano CAD selecionado. XY corresponde ao chão X/−Z em RH_Y_UP. XZ corresponde a X/Y e YZ a −Z/Y. O plano recebe a face inferior da caixa. A orientação pode preservar o repouso, alinhar a rotação aos eixos da cena, girar 90 graus, alinhar o eixo local mais comprido ou usar o ajuste individual.

A caixa projetada conservadora inclui todos os oito vértices de cada caixa de malha após a transformação. Ela tolera espelhamento, escalas não uniformes e peças compostas. A folga calculada vale para o layout final em projeção. Encaixes, colisões ao mover e estabilidade física exigem análises próprias.

## Disposição e transição

A grade mede a maior largura em cada coluna e a maior altura em cada linha. A grade por grupos calcula colunas por grupo e aplica uma folga adicional. A prateleira quebra linha por largura disponível. Peças mais largas recebem uma linha própria e aviso. A ordem de montagem usa as etapas autoradas e indica as peças sem etapa. O modo de tipos usa o representante e a quantidade do catálogo. A ordenação trata campos ausentes ao final em ordem crescente e usa ID como desempate estável.

Fixações guardam coordenadas no plano separadas da rotação. O motor reserva uma faixa distinta para a disposição automática e verifica as fixações por varredura de eventos com contagem de intervalos. Havendo conflito, avisa e pede correção dos parâmetros. A transição interpola a rotação e o deslocamento absolutos. O controlador inverte a matriz do pai ativo para manter a posição mundial dos descendentes e restaura as matrizes locais ao sair ou zerar a transição.
