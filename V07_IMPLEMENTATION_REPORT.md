# GeoGenViewer V0.7 — implementação

A V0.7 adiciona dois fluxos locais. Comparar carrega dois pacotes, resolve a correspondência entre seus componentes, mostra as diferenças em uma ou duas regiões do mesmo Canvas e exporta CSV, JSON e PNG. Quantitativos usa os mesmos registros de componente para calcular cobertura, subtotais e análises de material por revisão e escopo.

## Arquitetura

- `geogenviewer/src/lib/geogen/revisions/` concentra captura de pose de repouso, identidade, correspondência, alinhamento, geometria, quantitativos, fabricação, inspeções e relatórios.
- `geogenviewer/src/features/viewer/state/revision-workspace.ts` coordena a revisão secundária, cancelamento, descarte, ordem, parâmetros e seleção. O casamento é indexado, e o diff retorna ao event loop entre lotes. A câmera não participa do cálculo analítico.
- `comparison-scene.tsx` reutiliza o rig atual no Canvas do visualizador com uma cena e câmeras separadas para as revisões. As cópias de nós compartilham buffers e materiais originais da importação. Variantes visuais e recursos de captura são descartados. Ao sair, a câmera e os estados anteriores voltam ao fluxo normal.
- Os componentes de comparação e quantitativos seguem os tokens e os primitivos existentes, com listas virtualizadas e gráfico CSS. A versão usa as dependências já instaladas.

## Decisões

A associação automática começa pelo ID de manifesto no mesmo projeto, depois usa a combinação de referências CAD. Sugestões autoradas ou heurísticas exigem confirmação. O diff distingue mudança de pose, forma local, material, camada, categoria, metadados, fabricação e montagem. Triângulos reordenados têm assinatura equivalente; tesselação diferente passa por uma comparação aproximada com limite de custo. O alinhamento opera em um referencial em metros perto da origem da base.

Quantitativos somam ocorrências identificadas. Área e volume conservam método e proveniência e o subtotal de um método não cobre valores indisponíveis. A análise de fabricação distingue massa maciça, slicer, medição e estimativa, com custos separados por moeda e método. A biblioteca e os cenários são dados de análise. O manifesto CAD 1.0.0 e `inspection.json` não recebem campos novos.

## Entregáveis

- [Auditoria](V07_REVISION_ANALYTICS_AUDIT.md) · [Correspondência](V07_REVISION_MATCHING_SPEC.md) · [Geometria e alinhamento](V07_GEOMETRY_COMPARISON_SPEC.md)
- [Quantitativos](V07_QUANTITIES_SPEC.md) · [Fabricação](V07_FABRICATION_ANALYTICS_SPEC.md) · [Interoperabilidade](EXPORTER_VIEWER_INTEROPERABILITY_NOTES.md)
- [Guia](V07_USER_GUIDE.md) · [Testes e capturas](V07_TEST_REPORT.md) · [Desempenho](V07_PERFORMANCE_REPORT.md)
- [Schema de comparação](geogenviewer/schemas/comparison-v1.schema.json) · [Schema de fabricação](geogenviewer/schemas/fabrication-analysis-v1.schema.json)
- [Laboratório](geogenviewer/public/demos/revision-lab/) · [Exemplos CSV e JSON](docs/v07/examples/)

## Limitações e continuidade

A análise usa superfícies tesselladas e tolerâncias configuráveis. Encaixes, comparação exata NURBS e validação estrutural precisam de um método próprio. O alinhamento por pontos, a comparação normalizada por escala e o divisor visual interativo são extensões secundárias. A captura de comparação registra as regiões e os rótulos de revisão. A composição editorial, relatórios HTML e pranchas continuam disponíveis para planejamento da V0.8.

As vistas salvas podem reaplicar a pose da câmera na comparação. A comparação usa os planos de corte do modelo originalmente aberto e o renderer respeita esses planos no picking. As medições associadas conservam seus pontos de origem. A revisão de equivalência leva em conta o tipo de medição e os componentes associados, e o usuário confirma as referências. O workspace Inspecionar continua disponível para cadastrar novos pontos.

Para a V0.8, as relações entre ocorrência, identificação autorada e componentes de catálogo oferecem uma base para knolling e documentação. Antes de expandir os resultados sintéticos para o estudo de caso, valide a granularidade e os metadados exportados no Rhino 8, a ergonomia em tablet físico e os arquivos autorizados da Casa Gerassi.
