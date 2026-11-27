# GeoGenViewer 0.9.12 · desempenho da candidata

Ensaio local em Windows com Chrome 159.0.8154.33. A automação usou viewport de 1280 × 800 CSS px, DPR solicitado de 1,5 e a mesma sequência de órbita em cada modo. Os modelos foram o pavilhão sintético de 18 ocorrências e uma fixture de 1.000 ocorrências repetidas. As amostras têm entre 11 e 13 intervalos por perfil em SwiftShader. As medidas são exploratórias e variam com o navegador, a carga do sistema e o dispositivo.

`FPS` é o inverso da média dos intervalos observados nos eventos do rig. P50 e P95 incluem o ritmo de entrada do Playwright e do navegador. Draw calls vêm do diagnóstico do Three.js. Os números de órbita usam chão e sombras desligados. Chão, sombras, composição e alfa também foram verificados nas capturas, em ensaios separados da medição de quadros.

## Chrome em ANGLE/SwiftShader

| Modelo | Modo | Qualidade | Draw calls | FPS por intervalos | P50 (ms) | P95 (ms) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 18 | Sombreado | Equilibrada | 24 | 12,5 | 76,0 | 102,0 |
| 18 | Materiais GLB | Equilibrada | 24 | 13,1 | 74,8 | 94,7 |
| 18 | Técnico | Equilibrada | 47 | 13,3 | 72,1 | 96,4 |
| 18 | Mono | Equilibrada | 47 | 14,3 | 73,5 | 98,9 |
| 18 | Blueprint | Equilibrada | 48 | 13,3 | 78,9 | 103,0 |
| 18 | Dither | Equilibrada | 25 | 9,9 | 100,2 | 113,1 |
| 18 | Clay | Equilibrada | 50 | 6,2 | 163,8 | 256,9 |
| 18 | Clay | Alta | 50 | 4,0 | 260,6 | 464,4 |
| 18 | Clay | Desempenho | 24 | 15,9 | 65,2 | 69,8 |
| 1.000 | Sombreado | Desempenho | 2 | 13,8 | 77,0 | 112,9 |
| 1.000 | Mono | Desempenho | 2.001 | 6,4 | 157,6 | 171,2 |
| 1.000 | Blueprint | Desempenho | 2.002 | 6,3 | 164,2 | 269,3 |
| 1.000 | Dither | Desempenho | 3 | 12,5 | 84,0 | 128,8 |
| 1.000 | Clay | Desempenho | 2 | 13,6 | 75,6 | 116,5 |

Os modos com contornos forçados preservam uma malha e um desenho de arestas por peça nessa fixture. O preset Desempenho continua com esse custo em Mono e Blueprint. Clay em Desempenho dispensou o GTAO ao vivo. Nas duas escalas, todos os casos tiveram zero eventos de quadro na janela ociosa de 280 ms da candidata em SwiftShader.

## Chrome em Intel Graphics / Direct3D 11

O ANGLE identificou o adaptador Intel `0x0000A7AB` com D3D11. A mesma matriz passou com 11–13 intervalos por perfil e zero quadros nos períodos ociosos de 280 ms.

| Modelo | Modo | Qualidade | Draw calls | FPS por intervalos | P50 (ms) | P95 (ms) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 18 | Sombreado | Equilibrada | 24 | 37,8 | 25,0 | 33,8 |
| 18 | Materiais GLB | Equilibrada | 24 | 41,2 | 25,0 | 33,3 |
| 18 | Técnico | Equilibrada | 47 | 35,7 | 25,3 | 33,4 |
| 18 | Mono | Equilibrada | 47 | 34,7 | 26,4 | 33,5 |
| 18 | Blueprint | Equilibrada | 48 | 35,0 | 30,6 | 35,2 |
| 18 | Dither | Equilibrada | 25 | 38,0 | 25,3 | 33,4 |
| 18 | Clay | Equilibrada | 50 | 38,7 | 25,1 | 32,1 |
| 18 | Clay | Alta | 50 | 36,8 | 25,2 | 35,1 |
| 18 | Clay | Desempenho | 24 | 43,7 | 25,0 | 26,3 |
| 1.000 | Sombreado | Desempenho | 2 | 36,7 | 25,2 | 33,5 |
| 1.000 | Mono | Desempenho | 2.001 | 32,0 | 31,3 | 36,9 |
| 1.000 | Blueprint | Desempenho | 2.002 | 31,5 | 33,3 | 42,9 |
| 1.000 | Dither | Desempenho | 3 | 39,3 | 25,0 | 36,4 |
| 1.000 | Clay | Desempenho | 2 | 33,0 | 25,3 | 49,9 |

## Recursos e comparação com a Sprint B

O instrumentador intercepta criação, descarte e link de recursos no WebGL2. Em SwiftShader, a candidata estabilizou em **5 texturas, 3 framebuffers, 0 renderbuffers, 5 buffers e 6 programas** depois de retornar a Sombreado em três ciclos de Mono, Blueprint, Dither, Clay e Sombreado no mesmo modelo. A mesma contagem de recursos foi observada no Intel. A Sprint B manteve contagens iguais nos quatro primeiros tipos, com programas de **10 para 11** antes de estabilizar. A inspeção do Three.js identificou os dois materiais fora do descarte padrão. A validação mede objetos vivos na API e a VRAM residente continua pendente de um profiler de dispositivo.

O código evita invalidar o shader GTAO a cada quadro e libera seu material dedicado. Os programas de modos descartados podem ser compilados novamente ao reentrar. As texturas temporárias da captura são recriadas quando a resolução muda. O ensaio cobre estabilidade dos recursos na sessão testada, com janela curta e cenas sintéticas.

## Capturas e limites

Foram lidos do PNG **1280 × 1340**, **1920 × 2010** e **3840 × 4021** na região em perspectiva testada. A captura transparente permitiu pixels de alfa zero fora do modelo e preservou conteúdo na imagem. O Clay em Desempenho gerou PNGs distintos nas exposições mínima e máxima. Os avisos do SwiftShader durante as capturas foram de espera por `readPixels`. O caminho de exportação lê a GPU de forma síncrona.

O teste de 1.000 peças exercita repetição e seleção por ocorrência. A validação em modelos densos com muitas malhas distintas, consumo de VRAM, sessões prolongadas e tela física depende da homologação. [Auditoria e matriz](SPRINT_C_RELEASE_AUDIT.md) · [Checklist manual](V1_RELEASE_CANDIDATE_CHECKLIST.md)

## Reprodução

Execute `npm run build` e `npm run test:sprint-c` em `geogenviewer/`. O relatório JSON e os PNGs são gravados em `test-results/sprint-c/`. Use `GEOGEN_SPRINT_C_HARDWARE=1` para omitir o SwiftShader forçado e gravar em `test-results/sprint-c-hardware/`. O JSON identifica o driver realmente utilizado. `GEOGEN_SPRINT_C_BASELINE=1` registra resultados sem exigir as correções específicas da candidata e deve ser executado com o bundle anterior.
