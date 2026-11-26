# GeoGenViewer V0.5 — relatório de implementação

A V0.5 integra a inspeção, a vista explodida e a montagem em uma cena 3D compartilhada. A base local é a V0.4 no commit `c20be20`.

| Entrega | Implementação |
|---|---|
| Auditoria | Baseline V0.4, revisão do código do CraftBot e reorganização do escopo. [Auditoria](V05_VIEWER_AUDIT.md) |
| Navegação | Oito orientações predefinidas, perspectiva e ortográfica, cubo com faces, arestas e vértices, quatro layouts, maximização e vistas locais. Zoom ortográfico e alvo podem ser sincronizados. Seleção e visibilidade são compartilhadas por padrão e podem ser independentes. |
| Inspeção | Model Browser redimensionável em desktop e painéis em tablet/celular. Busca semântica, hierarquias, agrupamentos, filtros combinados, presets, ações rápidas, seleção e proveniência das propriedades. |
| Apresentação | Nove modos de exibição, controles de iluminação e cena, modo limpo, tela cheia, três perfis de DPR, diagnóstico e exportação PNG da viewport ativa. |
| Montagem | Timeline por tempo acumulado, poses a partir do repouso, peças futuras ocultas ou em transparência, passos isolados e editor com validação. O manifesto exportado mantém a identificação da geometria e seu SHA-256. |
| Interoperabilidade | Pacote original de referência preservado. O pavilhão sintético ganhou seis etapas e revisão `rev-05`, com os mesmos bytes GLB. O relatório auxiliar do exportador é opcional na abertura do pacote. |

## Fronteiras no código

- `src/lib/geogen/assembly/` compila os passos, amostra a timeline, aplica a translação em espaço mundial e revalida o manifesto editado.
- `src/lib/geogen/domain/visibility.ts` resolve facetas, layers ancestrais e pesquisa de metadados. As regras de composição são comuns à árvore e ao renderer.
- `src/features/viewer/scene/` mantém o pipeline R3F, um contexto WebGL, câmeras por região, raycasting por região e cache de variantes de material e arestas.
- `src/features/viewer/state/` concentra interação semântica, preferências de apresentação, escopos por vista e playback. O renderer calcula o instante com relógio monotônico. A timeline atualiza seus controles sem propagar tempo a cada frame pelo estado global.
- `src/features/viewer/components/` reúne controles de vista, filtros, exibição, timeline e editor. Foram reaproveitados os primitivos Base UI e os tokens existentes.

## Decisões e limites

O Canvas preserva a cena e o compartilhamento de geometrias ao mudar de layout. Em quatro vistas, as quatro passagens ainda ampliam o custo de desenho. O modo técnico usa limiar angular de 22° nas arestas da malha. Ambientes que bloqueiam o armazenamento local podem manter as vistas e combinações durante a sessão aberta.

Named Views e combinações são vinculadas à identidade do projeto e à revisão. Em GLB avulso a identidade de conveniência é nome do arquivo e tamanho em bytes. O rascunho de montagem usa também o SHA-256 declarado quando disponível. O editor mantém o manifesto de origem em memória para retorno à sequência importada.

A orientação de planta segue o contrato Rhino–Three.js. Corte avançado, medição de malha e documentação técnica detalhada ficam na V0.6. Medidas de fabricação continuam vinculadas à proveniência exportada. A sequência ilustra deslocamentos, cuja validação física é independente.

## Reprodução e evidências

- [Guia de utilização](V05_USER_GUIDE.md)
- [Relatório de testes e capturas](V05_TEST_REPORT.md)
- [Relatório de desempenho](V05_PERFORMANCE_REPORT.md)
- [Arquitetura](ARCHITECTURE.md)
