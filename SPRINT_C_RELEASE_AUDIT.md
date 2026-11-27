# GeoGenViewer 0.9.12 · auditoria da candidata

Data de auditoria 27/11/2026. A base da Sprint A foi `0588b6d`. A Sprint B chegou como alterações locais e foi registrada no commit `dc6d2e2` antes das correções. A base de integração verificada foi `origin/main` em `eeb02e2`. A versão `0.9.12` coincide no aplicativo, em `package.json` e no lockfile. O contrato de importação permanece CAD JSON 1.0.0.

## Resultado por área

| Área | Verificação | Evidência automatizada |
| --- | --- | --- |
| Importação e identidade | GLB com e sem manifesto, validação, nomes de origem, PartID antigo e novo, ausente e duplicado, UUID e seleção por ocorrência | `npm test`, `test:v091`, `test:v0912` |
| Quantitativos e fabricação | Fonte CAD prioritária, subtotal por escopo, unidades, grupos, cobertura, volume geométrico, massa e custo por método | `npm test`, `test:v07`, `test:v0912` |
| Pose e documentação | Montagem e explosão reversíveis, orientação pelas faces e pelo eixo principal, título de etapa persistente, PartID em pesquisa e callouts | `npm test`, `test:v05`, `test:v08`, `test:v0912`, suíte Sprint B |
| Inspeção e organização | Clipping, picking, medição, seleção, isolamento, ocultação, camadas, grupos e recuperação de contexto | `test:v06`, `test:v07`, `test:v09`, `test:v091` |
| Mono | Superfície sem iluminação e sem tone mapping, paleta direta, arestas por ângulo, controle de espessura e inversão | Testes de perfis, captura em 1280 e 1920, inspeção das capturas |
| Blueprint | Tema completo, popover, controles nativos, escopo de portal, retorno ao tema anterior, seleção e vistas preservadas | Suítes Sprint B, Sprint C e V0.9.12, contraste automatizado com axe |
| Dither | Bayer 4×4 e 8×8 distintos, captura byte a byte estável na mesma pose, isolamento da interface, PNG opaco e transparente | `test:sprint-c`, inspeção das capturas |
| Clay | Material temporário, orçamento de GTAO, iluminação, chão, sombras PCF, exposição, descarte, perspectiva e ortográfica | Testes de renderer, `test:sprint-c`, suíte Sprint B |
| Preferências e UI | Vistas legadas, migração `clay` → Mono, qualidade, modo, exposição, títulos, teclado e layout | `test:v0912`, `test:ui`, `test:v09`, suíte Sprint B |
| Exportação | PNG 1280, 1920 e opção 3840, validação de imagem decodificada e alfa, técnicas com medidas e callouts, vistas explodidas e Knolling | `test:sprint-c`, `test:v05`, `test:v06`, `test:v08` |

## Correções e confirmação

- **Clay e GPU.** O getter de oclusão do Three.js já lê a textura filtrada. O método `GTAOPass.dispose()` da versão instalada omite `gtaoMaterial` e `blendMaterial`. A release libera ambos, calcula a espessura em função do raio e atualiza por quadro apenas os uniforms variáveis. Intensidade zero libera o passe de oclusão. A segunda renderização de normais usa as sombras desativadas localmente.
- **Clay em PNG.** Na Sprint B, os extremos do controle de exposição geraram arquivos transparentes idênticos no preset Desempenho. A regra do exportador agora aciona a composição sem GTAO nessa qualidade. Há uma asserção no teste de integração para comparar as duas imagens.
- **Mono e Blueprint.** A paleta unlit usa cores diretas. O caminho de arestas espessas aplica os valores fracionários que o controle já aceitava. No Blueprint, o esquema nativo medido na Sprint B era `light dark`, apesar dos tokens escuros. A candidata aplica `dark` também nos portais e restaura os tokens após sair.
- **Dither.** A ordem Bayer 8×8 usa a matriz 4×4 nas subdivisões finas. A origem do padrão arredonda para a coordenada física da viewport. Os adaptadores verificam a extensão de cor em ponto flutuante e entregam o desenho convencional quando indisponível. Em Chrome, a remoção simulada de `EXT_color_buffer_float` preservou a geometria e o fundo transparente dos PNGs de Dither e Clay, com zero erros de página ou console.

## Execução e limites

| Comando | Resultado |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` | Passaram, com 79 testes automatizados e build de produção |
| `npm run test:ui`, `test:v05`, `test:v06`, `test:v07`, `test:v08`, `test:v09`, `test:v091`, `test:v0912` | As suítes Playwright históricas passaram no bundle da candidata |
| `npm run test:sprint-c` | Passou em SwiftShader e Intel/D3D11, incluindo três ciclos de descarte e PNG em perspectiva e ortográfica |
| `node scripts/verify-sprint-b.mjs` | Passou com as capturas dos quatro modos, Clay em Knolling, tema Blueprint e o popover em tablet e celular emulados |
| `npm run benchmark:v091` | Passou na escala de até 10.000 ocorrências sintéticas |

Os comandos de validação rodam a partir de `geogenviewer/`. A matriz gráfica foi executada em Chrome com SwiftShader e Intel/D3D11, com 14 perfis e 12 PNGs em cada ambiente. Em ambos, axe retornou zero violações no Blueprint com Exibição aberto. As quatro capturas de viewport da sessão em SwiftShader foram inspecionadas mantendo o modelo e o enquadramento de referência. [Desempenho e recursos](SPRINT_C_PERFORMANCE_REPORT.md)

- O passo de oclusão fica reservado aos orçamentos elegíveis. Em viewport compacta, regiões múltiplas, corte ativo ou captura técnica, a verificação deve esperar o desenho convencional previsto. As sombras de contato visíveis dependem de GTAO ou PCF com plano receptor. A captura técnica usa a saída de documentação, com callouts e medidas próprios.
- A largura efetiva do PNG depende do aspecto e do limite de textura. O teste registra as dimensões lidas do arquivo. Validar a igualdade exata de brilho, sombras e arestas em outro hardware continua parte da homologação manual.
- A auditoria usou modelos sintéticos e testes emulados de layout, touch e acessibilidade em tablet e celular. As larguras emuladas incluíram 1024, 768, 390 e 375 px. Permanecem pendentes o Rhino 8, a Casa Gerassi autorizada e os dispositivos físicos. [Checklist manual](V1_RELEASE_CANDIDATE_CHECKLIST.md)
