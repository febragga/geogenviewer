# V0.8 — catálogo

O catálogo trabalha com registros semânticos, proveniência geométrica e analítica e identidade por ocorrência. Part ID e tipo vêm de propriedades existentes. O tipo aceita `GeoGen:TypeId` e a convenção `GeoGen:TypeCode`. Definição de bloco como tipo exige ativação explícita. Grupos manuais pertencem ao documento V0.8.

O representante é a primeira ocorrência pelo ID ordenado, e a quantidade soma todas as ocorrências do tipo. O motor sinaliza variantes de material, dimensões autoradas, tolerância, escala e espelhamento no mesmo tipo. O usuário pode confirmar o agrupamento. A similaridade geométrica sozinha não define um tipo de fabricação.

A lista do catálogo é virtualizada e tem cartões, tabela, lista compacta e modos por tipo e classificação. Busca inclui nome, IDs, metadados pesquisáveis e camadas. Filtros do visualizador podem servir de escopo. As seleções na revisão primária passam pelo store do visualizador. A seleção da revisão secundária usa a mesma chave de importação empregada em Quantitativos. O catálogo localiza a ocorrência na montagem e mostra a correspondência confirmada da V0.7.

## Miniaturas

Uma fila serial usa o renderer do visualizador e render targets temporários. O índice por revisão encontra apenas as malhas pedidas. O cache LRU guarda até 96 imagens pequenas e usa revisão, hash, IDs, orientação, estilo, fundo e resolução. O componente gera miniaturas para linhas dentro da janela virtualizada e cancela pedidos ao sair da janela. URLs revogadas e alvos descartados encerram a vida dos recursos.
