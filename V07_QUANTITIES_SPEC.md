# V0.7 — quantitativos

Cada registro semântico entra uma vez no total por chave de ocorrência. A malha descendente de um compósito é atribuída ao componente que a possui. Uma definição de bloco compartilhada informa um tipo e contribui com todas as ocorrências posicionadas. O subtotal de geometrias referencia os buffers compartilhados dentro da importação. Instâncias GPU pertencentes diretamente a um componente podem contribuir com múltiplas ocorrências no mesmo registro.

Os escopos incluem modelo completo, visibilidade, filtros, seleção, categoria, material e componentes modificados. Os agrupamentos incluem categoria, camada, material de fabricação, bloco, Part ID, código de tipo, protótipo, propriedade e grupos. Grupos de associação múltipla geram aviso quando os subtotais se sobrepõem. Geometrias ou medidas próximas não definem tipo.

A área e o volume importados preservam sua proveniência. Na ausência de área, o cálculo soma as áreas trianguladas com transformações de repouso. O volume autorado e o CAD são identificados pelo método. Para estimar volume da malha, cada submalha precisa ter uma malha orientada fechada conforme incidência de arestas soldadas por posição e volume assinado diferente de zero. Esse teste é conservador para compósitos cujos submeshes abertos só se fecham em conjunto. A soma representa os volumes individuais e pode incluir regiões sobrepostas.

Subtotais separam métodos. A cobertura relata o número de registros incluídos e excluídos, o percentual e os motivos. Zero informado entra no denominador de valores conhecidos. Uma célula vazia no CSV representa grandeza indisponível.

A tabela usa janela de linhas visíveis, ordenação, busca, escopo, grupos e colunas configuráveis. A seleção pode ser feita pelo nome, por caixas de seleção ou pela viewport. O painel analítico usa gráficos em HTML/CSS e declara método e moeda nos gráficos de volume e de custo.
