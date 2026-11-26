
# GeoGenViewer V0.9.1 — auditoria de engenharia

A base auditada foi `e83ad98` em `feat/v0.9-product-design-performance`, commit do Gemini com 112 arquivos. A árvore inicial estava limpa. `6563d7d` já consolidava a V0.8 na main e é ancestral da base da V0.9.1. As mudanças foram desenvolvidas em `fix/v0.9.1-engineering-audit`.

## Reprodução na V0.9.0

Lint, TypeScript, 62 testes, build e as suítes `ui`, `v05`, `v06`, `v07` e `v08` passaram. Uma execução de `v09` falhou em contraste no estado claro da home. A falha não apareceu em uma reprodução isolada. A produção também emitia aviso de `metadataBase`. Os benchmarks CPU foram reexecutados com os scripts da base. [Resultados comparativos](V091_PERFORMANCE_REPORT.md)

## Matriz

| Prioridade | Achado | Tratamento |
| --- | --- | --- |
| P0 | Duas ocorrências CAD podiam reivindicar o mesmo objeto pela estratégia nominal, comprometendo seleção e quantitativos | A importação exige propriedade exclusiva da raiz, rejeita sub-malha atribuída a outro elemento e exige malha no alvo |
| P1 | Uma organização de outra revisão era importada mesmo quando declarada incompatível. A chave local priorizava o hash e ignorava a distinção entre revisões | Restauração valida identidade antes de aplicar alterações. V0.9.0 migra quando título legado, revisão e binário identificam o modelo |
| P1 | Mostrar um grupo podia remover a ocultação direta ou de outro grupo sobreposto | Máscaras independentes por origem e ID, composição por união e separação por viewport quando configurada |
| P1 | V0.9.0 agrupava transparência, matriz espelhada e filhos de ancestrais invisíveis. Uma transformação explícita de comparação era substituída pela TRS local. Limites desatualizados bloqueavam picking | Fallback para malhas incompatíveis e estilos com transparência ou bordas, matrizes relativas e invalidação da esfera de picking |
| P1 | Ancoragem de uma medida podia receber a instância transitória do renderer em vez da malha de origem | Interseção resolvida para a malha original com identidade preservada |
| P1 | JSON glTF podia passar pela pré-validação com referência de cena inválida ou transformação não finita. A implementação do loader mescla extras em `userData` | Pré-validação de estrutura, referências, chaves e profundidade antes do decode |
| P1 | Ler projetos recentes podia falhar após abrir o modelo se o navegador lançasse exceção ao acessar `localStorage` | Armazenamento opcional em regiões protegidas. Documento de organização fica em memória durante falha de escrita, com aviso para exportar |
| P2 | O botão ativo de organização no tema claro usava branco sobre o azul da marca, com falha de contraste em axe | Uso dos tokens semânticos de fundo e texto para a ação pressionada |
| P2 | Preferência de tema da home divergia das configurações do viewer. Vistas GLB-only eram vinculadas ao nome e ao tamanho | Tema canônico em ambas as rotas. Novas vistas e filtros GLB vinculados ao hash |
| P2 | Atalho de criação de camada gerava duas operações de histórico. Mover uma subárvore validava a altura dos ancestrais, deixando de verificar descendentes | Criação e atribuição em uma operação. Altura da subárvore considerada na mudança de pai |
| P2 | O manual limitava as ilustrações a 20 etapas sem explicitar a cobertura antes da geração | Cobertura exibida antes da geração e na prancha. Lista das etapas sem ilustração e sequência completa no JSON |
| P3 | Aceleração espacial, perfis em dispositivos físicos e variantes de documentação ampla | [Limitações e backlog](KNOWN_ISSUES.md) |

Os efeitos de uma alteração de cor, de modo ou de pose só justificaram refatorações no ciclo de vida de recursos, no caminho de instancing e nas fronteiras de estado. [Arquitetura](V091_ARCHITECTURE_REVIEW.md)
