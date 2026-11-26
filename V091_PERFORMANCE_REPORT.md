
# GeoGenViewer V0.9.1 — desempenho

## Node, Windows x64

Node `22.14.0`, Three.js sem WebGL e fixtures sintéticas. O perfil mede 60 amostras após 10 aquecimentos e registra p50 e p95. A coluna de picking mede o lote isolado. O navegador também descarta drawables invisíveis antes de consultar a malha ou o lote.

| Ocorrências | Fixture | Atualização visual p95, base → final | Matrizes p95, base → final | Picking de lote p95, base → final | Malhas instanciadas, base → final |
| ---: | --- | ---: | ---: | ---: | ---: |
| 100 | Repetida | 0,347 → 0,294 ms | 0,016 → 0,01 ms | 0,167 → 0,169 ms | 100 → 100 |
| 100 | Mista | 0,087 → 0,059 ms | 0,026 → 0,028 ms | 0,035 → 0,032 ms | 100 → 75 |
| 1.000 | Repetida | 0,259 → 0,237 ms | 0,17 → 0,069 ms | 0,097 → 0,177 ms | 1.000 → 1.000 |
| 1.000 | Mista | 0,264 → 0,222 ms | 0,107 → 0,099 ms | 0,144 → 0,157 ms | 1.000 → 750 |
| 10.000 | Repetida | 1,376 → 1,045 ms | 0,886 → 1,449 ms | 0,711 → 0,803 ms | 10.000 → 10.000 |
| 10.000 | Mista | 2,166 → 1,482 ms | 1,006 → 1,241 ms | 0,762 → 0,532 ms | 10.000 → 7.500 |

A fixture mista reúne duas geometrias, três lotes potenciais por combinação e 25% de malhas semitransparentes. Essas malhas voltam ao caminho individual na V0.9.1 para manter composição e ordenação. Em 10.000 ocorrências, a estimativa passa de 3 para 2.502 desenhos de geometria. A fixture repetida mantém 1 por lote. A validação adicional tem custo de construção; os resultados de matrizes e picking variam e tiveram regressão na fixture repetida de 10.000 no p95. Atualizar estado visual foi mais rápido na mesma escala.

Para 10.000 ocorrências em Node:

| Operação | V0.9.0 | V0.9.1 |
| --- | ---: | ---: |
| Knolling, importação | 289,724 ms | 292,701 ms |
| Knolling, disposição | 29,664 ms | 29,177 ms |
| Knolling, seis poses | 44,992 ms | 42,583 ms |
| Comparação, correspondência | 7,96 ms | 6,846 ms |
| Comparação, diff geométrico e semântico | 120,226 ms | 114,565 ms |
| Inspeção, picking de caixas p95 | 0,464 ms | 0,718 ms |
| Inspeção, snap p95 | 0,002 ms | 0,002 ms |
| Inspeção, reconstrução de caps p95 | 7,501 ms | 7,938 ms |

O Node observou 1/1 geometrias usadas/descartadas no knolling e 2/2 na comparação a 10 mil ocorrências. A diferença de heap após a importação na medição de Knolling foi 141,481 → 125,666 MiB. O heap estimado para cena repetida mais lote foi 17,104 → 17,193 MiB. São observações do processo, influenciadas pelo coletor de lixo. [Dados brutos](docs/v091/evidence/)

## Navegador

Chrome `159.0.8154.33`, Windows, 1440×900. O perfil em software informa ANGLE/SwiftShader. A execução independente em hardware informa ANGLE/Direct3D11, Intel Graphics `0x0000A7AB`. Medidas de navegador incluem trabalho da aplicação e automação. Os resultados de software e hardware são séries distintas.

| Renderer | Peças | Carga + disposição | Miniatura | Filtro e seleção | Ficha | PNG | Draw calls | Quad 10k |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SwiftShader V0.9.0 | 100 | 481 ms | 221 ms | 84 ms | 912 ms | 278 ms | 2 | — |
| SwiftShader V0.9.0 | 1.000 | 590 ms | 243 ms | 92 ms | 501 ms | 348 ms | 2 | — |
| SwiftShader V0.9.0 | 10.000 | 1.004 ms | 295 ms | 273 ms | 688 ms | 513 ms | 2 | — |
| SwiftShader V0.9.1 | 100 | 509 ms | 190 ms | 84 ms | 389 ms | 422 ms | 2 | — |
| SwiftShader V0.9.1 | 1.000 | 635 ms | 230 ms | 111 ms | 438 ms | 382 ms | 2 | — |
| SwiftShader V0.9.1 | 10.000 | 1.062 ms | 111 ms | 269 ms | 367 ms | 390 ms | 2 | 12 |
| Intel V0.9.1 | 100 | 293 ms | 69 ms | 89 ms | 267 ms | 125 ms | 2 | — |
| Intel V0.9.1 | 1.000 | 324 ms | 83 ms | 82 ms | 252 ms | 154 ms | 2 | — |
| Intel V0.9.1 | 10.000 | 754 ms | 75 ms | 138 ms | 227 ms | 125 ms | 2 | 12 |

Os intervalos medem eventos de frame com 20 sinais de roda espaçados por cerca de 35 ms. A janela inclui a cadência do estímulo e a execução do navegador, com 9–19 intervalos por linha. O p95 de séries curtas é descritivo. O FPS em atividade é uma leitura instantânea do diagnóstico e consta no JSON.

| Renderer | Peças | Amostras | Intervalo p50 | Intervalo p95 | Frames em repouso (250 ms) |
| --- | ---: | ---: | ---: | ---: | ---: |
| SwiftShader | 100 | 19 | 42,4 ms | 54,3 ms | 0 |
| SwiftShader | 1.000 | 19 | 42,5 ms | 54,5 ms | 0 |
| SwiftShader | 10.000 | 9 | 94,5 ms | 178,2 ms | 0 |
| Intel | 100 | 19 | 40,1 ms | 50,1 ms | 0 |
| Intel | 1.000 | 19 | 40,3 ms | 52,7 ms | 0 |
| Intel | 10.000 | 19 | 40,8 ms | 61,6 ms | 0 |

O knolling manteve 2 geometrias, 2 materiais e 120.000 triângulos com 10.000 peças em uma viewport. O Quad registrou 12 desenhos e cerca de 480 mil triângulos. Após substituir por um GLB de 8 componentes, o canvas anterior foi removido e a cena voltou a 9 desenhos e 96 triângulos, com um único canvas atual. Esses contadores não representam VRAM residente.

A comparação lado a lado com 10.000 ocorrências por revisão em SwiftShader registrou 2 draw calls, 240.000 triângulos e 1.664 ms no fluxo medido. A V0.8 histórica registrava 10.001 draw calls no knolling equivalente. A V0.7 histórica registrava 20.000 na comparação. Esses números históricos identificam o ganho já estabelecido pela V0.9.0. O patch mantém a redução no material repetido compatível e corrige o fallback das cenas incompatíveis. [Referência V0.8](docs/v08/evidence/browser.json) · [Referência V0.7](docs/v08/evidence/baseline-v07-browser.json)

[SwiftShader](docs/v091/evidence/profile-swiftshader.json) · [Intel](docs/v091/evidence/profile-intel.json) · [Comparação](docs/v091/evidence/compare-browser.json)

## Reproduzir

Execute os comandos na pasta `geogenviewer`.

```powershell
npm run benchmark:v091
npm run benchmark:v05
npm run benchmark:v06
npm run benchmark:v07
npm run benchmark:v08
npm run build
$env:GEOGEN_V07_GPU='1'
npm run test:v07
$env:GEOGEN_V08_GPU='1'
$env:GEOGEN_V091_PROFILE='1'
npm run test:v08
$env:GEOGEN_V091_HARDWARE='1'
npm run test:v08
```

Para comparar o gerenciador de lotes com o Gemini, extraia `geogenviewer/src/features/viewer/scene/instancing.ts` de `e83ad98` em um arquivo temporário dentro de `geogenviewer/test-results` e passe o caminho como argumento a `npm run benchmark:v091 -- <caminho>`. Os resultados usam projetos e fixtures sintéticos. [Baseline e amostras](docs/v091/evidence/)
