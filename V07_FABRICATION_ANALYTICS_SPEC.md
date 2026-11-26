# V0.7 — análise de fabricação

A análise usa massa em kg, volume em m³, densidade em kg/m³, custo por kg na moeda de origem e tempo em segundos. A massa maciça teórica é `volume × densidade`. Massa do slicer, massa medida e estimativa autorada são entradas independentes. Cada valor registra método, fonte e detalhe de proveniência.

A biblioteca local contém código, nome, densidade, preço, moeda, fonte e observações. A associação precisa do material de fabricação declarado em `fabrication.material`. Para vínculo CAD, deve existir um único material no manifesto com o ID ou nome informado. A biblioteca pode complementar dados faltantes no CAD. Uma substituição de cenário usa os valores do material de cenário e computa custo apenas com massa teórica. As medições originais continuam disponíveis.

O custo de material usa `massa × preço/kg`. A análise gera subtotais por moeda e método de massa e a exibição identifica a cobertura. Tempo de máquina, estimativa de produção e tempo registrado aparecem separadamente. O subtotal de tempo de máquina é a soma das entradas do escopo. A estimativa de prazo com recursos paralelos requer programação de produção.

Campos personalizados usam as convenções descritas nas notas de interoperabilidade. O painel permite mapear explicitamente os campos e informar um valor por componente com fonte. Para comparar protótipos, o relatório alinha métodos, grandezas e moedas e sinaliza cobertura parcial ou diferente.
