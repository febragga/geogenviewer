# GeoGenViewer — análise técnica do CraftBot

**Data:** 25/11/2026  
**Estado:** auditoria estática da revisão registrada na seção 9. Benchmark pendente.

## 1. Referência

- Autor: Luka Piškorec.
- Repositório: https://github.com/lukapiskorec/craftbot
- Visualizador: https://lukapiskorec.github.io/craftbot/
- Licença: https://github.com/lukapiskorec/craftbot/blob/main/LICENSE

CraftBot é um toolkit de pesquisa para agentes de projeto arquitetônico que produzem código procedural em Python/Blender. O GeoGenViewer não precisa reproduzir o sistema de agentes. A referência relevante é a separação entre produção geométrica, exportação, visualização e semântica de construção.

## 2. Evidências documentadas

O README descreve um visualizador WebGL estático baseado em módulos JavaScript e Three.js, alimentado por JSON exportado do Blender em modo headless. O autor relata arquivos 10–20 vezes menores que os `.blend` correspondentes (não é comparação com GLB nem resultado medido por nós). A interface apresenta versões, filtros de componentes, inspeção dimensional, cortes, estilos gráficos e animações de montagem. Também organiza peças em arranjos de exposição (knolling) e associa anotações a documentos. A versão móvel recolhe os painéis. O deploy é feito em GitHub Pages.

A existência e o comportamento geral desses recursos são descritos pelo autor; estruturas internas, algoritmos, precisão, custos GPU e compatibilidade ainda exigem análise local. Não houve execução de Blender, inspeção de todos os módulos ou validação do viewer em tablet nesta etapa.

## 3. Mapa de estudo para o Codex

| Caminho documentado | O que verificar no clone | Resultado esperado |
|---|---|---|
| `viewer/` | Entrada, módulos, carregamento, renderer, controles | Mapa de dependências e responsabilidades |
| `viewer/models/` | Exemplos reais de JSON, indexação, identidades, unidades | Tabela de campos e correspondência com nosso schema |
| `tools/export_all_models.py` | Processo de exportação e scripts chamados | Entender tesselação, transforms, materiais e perdas |
| `tools/layers.py` | Classificação e gravação de layers | Comparar taxonomia por nome vs. metadados explícitos Rhino |
| `tools/callouts.py` | Ligações entre objetos e documentação | Contrato futuro para anotações |
| `tools/capture_knoll.mjs` | Pontos de integração de animação e captura | Identificar módulos de arranjo e mecanismos de timeline |
| `.github/workflows/` | Publicação do viewer estático | Comparar GitHub Pages com deploy Next/Vercel |
| `LICENSE` | Licença do projeto e atribuições | Política de reuso e inventário de terceiros |

Caminhos são pontos de partida confirmados pela documentação; verificar nomes e funções na revisão clonada, sem presumir APIs internas. O acesso direto à árvore `viewer/` pela consulta web falhou; portanto, não afirmar que o código-fonte foi auditado.

## 4. Decisões de adaptação

| CraftBot (documentado) | GeoGenViewer (proposta) | Estratégia |
|---|---|---|
| Blender + scripts Python | Rhino/Grasshopper como fonte inicial | Adaptar conceito, não copiar dependência de Blender |
| JSON geométrico próprio | GLB + manifesto JSON | Implementar formato interoperável; benchmark futuro |
| Three.js sem build | Next.js + React Three Fiber | Aproveitar experiência React e modularidade |
| Iterações e animação de entrada | Revisões com IDs persistentes, montagem explícita | Não deduzir sequência por nomes |
| Inspeção e filtros | Árvore de layers, grupos, picking e propriedades CAD | Reimplementar sobre contrato próprio |
| Knolling | Catálogo de peças e arranjo para fabricação | Pós-MVP; distinguir arranjo visual de nesting de impressão |
| Cortes e estilos | Clipping e modos gráficos | Avaliar seleção após recortes e custo em mobile |
| Callouts | Documentação vinculada a elementos | Pós-MVP; sanitizar conteúdo |
| GitHub Pages | Vercel + Cloudflare DNS | Infraestrutura independente do portfólio |

## 5. Questões técnicas a responder na auditoria

1. Como vértices, índices, normais, transforms, materiais e instâncias são serializados? Que informação CAD se perde?
2. Como o viewer identifica um objeto entre revisões? Há estabilidade de ID ou correspondência por nomes/atributos?
3. Como montagem e knolling armazenam poses originais, alvos e interpolação? Funcionam com hierarquias e escalas não uniformes?
4. Como seleção funciona com clipping e animações? Existe custo de CPU por objeto ou lógica na GPU?
5. Qual o efeito de materiais, sombras, ambient occlusion e outlines no desempenho de tablet?
6. Quais dependências e recursos estão distribuídos sob licenças próprias? Que partes são úteis sem levar todo o sistema?

## 6. Procedimento reproduzível para investigação local

Em pasta separada do repositório GeoGenViewer, com acesso à internet e autorização para comandos de rede:

```bash
git clone https://github.com/lukapiskorec/craftbot.git
cd craftbot
git rev-parse HEAD
git status --short
```

Ler README, LICENSE, árvore de `viewer/`, scripts relacionados e amostras JSON. Registrar SHA do commit auditado, paths, símbolos e linhas; não adicionar clone ou dados do CraftBot ao projeto principal por padrão. Após revisar o código, é possível testar a interface local com o comando documentado:

```bash
python -m http.server -d viewer 8123
```

Abrir `http://localhost:8123` e registrar carregamento, erros, interação, consumo de recursos e comportamento responsivo. A execução de exportadores ou agentes exige revisão prévia, Blender e dependências compatíveis. Não executar automaticamente scripts de terceiros. Comparar com uma fixture sintética equivalente usando GLB + manifesto; anotar número de peças, triângulos, tamanho de arquivo e dispositivo antes de qualquer conclusão de desempenho.

## 7. Licença e procedência

O arquivo LICENSE consultado declara MIT e copyright de 2026 de Luka Piskorec. A licença permite adaptação e distribuição do software, desde que os avisos exigidos acompanhem cópias ou porções substanciais. O documento também identifica Three.js (MIT) e uma fonte MonoMEK (CC0). Verificar novamente a licença e dependências no SHA usado; imagens, manuais, modelos de terceiros e referências acadêmicas podem ter direitos distintos. Não assumir licença geral para material de referência.

Política: priorizar implementação própria e conceitos; se reutilizar código, registrar arquivo, caminho original, SHA, autor, licença e alterações em `THIRD_PARTY_NOTICES.md`, incluir os avisos e preservar obrigações de distribuição. Não redistribuir materiais de referência sem permissão. Atribuir CraftBot em documentação mesmo quando usado só como inspiração. Não apresentar adaptação como contribuição original do GeoGenViewer.

## 8. Conclusão e limites

A referência sustenta a viabilidade de um visualizador construtivo no navegador. Não prova que o nosso contrato, stack ou desempenho sejam superiores. A decisão inicial é adotar GLB + JSON e testar a menor fatia do GeoGenViewer antes de portar qualquer módulo. O primeiro caso real será a Casa Gerassi, com dados autorizados e mantidos locais por padrão.

**Próxima ação:** atualizar este arquivo com auditoria em nível de código, SHA, amostras e resultados de execução; distinguir observações de hipóteses. A auditoria pode ocorrer em paralelo ao bootstrap, mas não deve bloquear um MVP sintético.

## 9. Auditoria estática do código em 25/11/2026

Revisão `2d52c09288c34f8b0e95157c213c4ed883ef59eb`, em checkout temporário separado. O `LICENSE` confirma MIT e registra Three.js (MIT) e MonoMEK (CC0). GeoGenViewer usa implementação própria.

| Evidência | Observação e aplicação ao GeoGenViewer |
|---|---|
| `tools/export_all_models.py` (`main`, linha 99) e `tools/export_model_json.py` (linhas 56–94) | O pipeline chama Blender e ordena objetos pelo `session_uid`. Caixas guardam matriz mundial 3×4. Malhas guardam posições em coordenadas mundiais e índices de faces poligonais. A hierarquia de transforms, as normais autoradas e as propriedades físicas CAD ficam fora desse caminho de exportação. Nosso GLB preserva a hierarquia e as malhas, e a ordem da montagem deve vir do manifesto. |
| `tools/model_export_core.py` (`rnd` e `build_model_dict`, linhas 68–112) e `tools/layers.py` (`classify` e `bake_dict`, linhas 189–224) | O exportador arredonda valores a cinco casas, corrige o winding com base no volume assinado e grava índices de coleção e camada. A classificação usa nome e coleção com regras por experimento. No GeoGenViewer, a origem da medida e as classes devem ser declaradas. |
| `viewer/models/01_Carport_Assembly_Blender_Python/chatgpt51_v01.json` | Amostra de 4.927 bytes, 56 caixas, nenhuma malha arbitrária, uma coleção e nove rótulos de camada. Cada caixa tem nome, índice de coleção, 12 componentes de matriz e índice de camada. A amostra não serve como comparação de tamanho ou desempenho com a fixture do GeoGenViewer. |
| `viewer/js/model-data.js` (`parseModel`, linha 129, e `matchElements`, linhas 294–328) | O parser deriva centros, dimensões e frames. O pareamento usa nome, tipo e características geométricas arredondadas e emparelha chaves iguais em ordem. ID persistente por ocorrência permite representar revisões mesmo quando a peça muda de pose. |
| `viewer/js/scene.js` (`buildModelGroup`, linha 33), `picking.js` (`makePicking`, linhas 13–86) e `main.js` (linhas 458–477) | Caixas usam instancing por grupo de renderização e malhas agrupadas mantêm mapa de face para elemento. A seleção por raycast descarta hits cortados. Durante transições o picking é suspenso e o layout assentado pode usar teste por caixas. A estratégia depende da representação da pose e merece teste antes de reaproveitar conceitos. |
| `viewer/js/animations.js` (`makeAnimations`, linha 100), `knolling.js` (`computeLayouts`, linha 320 e `interpolateLayout`, linha 365) e `tools/capture_knoll.mjs` (`setupExpr` e `capture`, linhas 218 e 353) | Animação usa atributos de pose para GPU. Knolling calcula quaternions e posições de layouts e interpola a partir dos layouts de origem e destino. A captura automatiza a visualização via Chrome DevTools. O código auditado não valida encaixes ou tolerâncias do nosso modelo. |
| `tools/callouts.py` (`resolve` e `check`, linhas 96–155) e `.github/workflows/pages.yml` | Callouts vinculam trechos Markdown a nomes de objetos. O workflow publica a pasta estática `viewer` no Pages. Essas decisões atendem ao catálogo do CraftBot. O visualizador local usa o contrato próprio de IDs e publicação separada. |

O código limita DPR a 2 no CraftBot. Ainda faltam execução do viewer do CraftBot, validação de tablet e benchmark comparável de custo de CPU/GPU, sombras e efeitos. O clone e suas amostras permaneceram fora do projeto.

[Código do CraftBot na revisão auditada](https://github.com/lukapiskorec/craftbot/tree/2d52c09288c34f8b0e95157c213c4ed883ef59eb)
