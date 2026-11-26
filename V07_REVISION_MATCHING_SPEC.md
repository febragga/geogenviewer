# V0.7 — correspondência de componentes

O pacote mantém o ID CAD para seleção e semântica. A combinação de uma chave de importação efêmera e o ID do componente distingue ocorrências de arquivos simultâneos, inclusive quando ambos contêm o mesmo ID. O documento persistido identifica cada lado pelo SHA-256 e pelos campos de revisão, protótipo, origem e escala.

A decisão manual tem precedência e exige pares um para um. Uma decisão pode vincular duas peças, registrar uma substituição ou deixar uma peça explicitamente sem par. Desfazer devolve os componentes à busca indexada.

No mesmo projeto com manifesto, o motor procura primeiro o ID de elemento. O segundo índice usa a combinação de objeto de origem, caminho de instância e definição de bloco. Aceita correspondência automática pelo segundo índice somente quando a combinação ocorre uma única vez em cada revisão. Se o exportador mudar IDs e a única pista for um GUID comum a várias peças, o motor pede revisão.

Códigos `GeoGen:PartId` e `GeoGen:FabricationCode` geram sugestões. Um índice de categoria, camada, bloco, posição aproximada em passos de 1 mm e assinatura local gera sugestões adicionais. A assinatura geométrica sozinha é insuficiente. Candidatos múltiplos aparecem como ambiguidades, com contagem e uma prévia de até 32 IDs. O usuário pode informar outro ID no editor.

Para Project IDs diferentes, ou GLB-only com hashes distintos, é necessário confirmar a associação. IDs de nós em GLB-only servem à seleção dentro da importação. Um par confirmado pode ser inalterado, modificado ou inconclusivo. Uma ausência decidida produz adição ou remoção. Sugestões pendentes produzem estado não resolvido.
