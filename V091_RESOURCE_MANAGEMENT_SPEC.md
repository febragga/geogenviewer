
# GeoGenViewer V0.9.1 — recursos e recuperação

| Recurso | Ownership e descarte |
| --- | --- |
| GLB original | O pacote possui geometrias, materiais, texturas, imagens e esqueletos. Seu descarte é idempotente e deduplica recursos compartilhados |
| Batch e display | O display possui malhas instanciadas, variantes, materiais auxiliares e arestas. A malha original toma emprestada geometria e material do pacote. O descarte reverte atributos temporários e solta o lote. Variantes ociosas podem ser removidas acima de 512 entradas |
| Comparação | Clones de apresentação tomam emprestados recursos da revisão. O pacote secundário é retirado após a atualização do estado. Promoção a primário transfere a responsabilidade |
| Miniaturas e capturas | Uma fila serial vincula imagens pequenas a revisão, hash, peça, aparência e dimensões, com teto de 96 entradas. Render targets são descartados após leitura. URLs temporárias e bitmaps são liberados por seus consumidores |
| Carregamento e servidores | O cancelamento interrompe fetchs e invalida pedidos antigos. Um resultado de decode obsoleto é descartado. `File.arrayBuffer()` e o decode interno são cooperativos apenas nos pontos de retorno |
| WebGL | Na perda, desmonta-se o Canvas e indica-se a recuperação. A ação de tentar novamente recria o visualizador a partir do modelo ativo local |

Recursos GPU têm orçamento dependente do driver. As evidências usam contadores do renderer, restauração de visibilidade, descarte do pacote e medidas aproximadas no Node. A execução sintética não mede residência em VRAM.

Capturas técnicas serializam trabalho entre os modelos. Cancelar a geração bloqueia a publicação de resultados antigos e descarta as solicitações ainda enfileiradas. Uma captura síncrona já em curso termina antes de liberar os recursos.
