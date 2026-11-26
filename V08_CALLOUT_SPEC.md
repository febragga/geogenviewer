# V0.8 — callouts e lista de peças

Callouts guardam ID próprio, componente, tipo, ponto no espaço local, deslocamento em pixels, estilo de linha e visibilidade. O documento identifica a revisão por SHA-256. O anchor inicial deriva do centro da caixa do componente. As matrizes em renderização projetam o mesmo anchor em explode, montagem e knolling. O deslocamento pode ser ajustado na interface sem alterar o anchor local.

O desenho oferece texto de peça, número, informações técnicas, etapa ou anotação livre. Linhas simples, com ponto, com seta, tracejadas e sem linha são opções. A organização em tela prioriza selecionados, testa deslocamentos vizinhos em uma grade de colisão 2D e limita o conjunto visível. Elementos ocultos, fora do enquadramento, recortados pelo plano e futuros na montagem saem da geração. Uma label dentro do enquadramento pode continuar visível à frente de outras superfícies. Essa política facilita identificar peças montadas e evita raycasts de oclusão a cada quadro.

A numeração segue a ordem do documento e se reflete no CSV e na lista de peças. O texto sai de React como texto ou é escrito com Canvas 2D. O mesmo compositor desenha callouts sobre imagens do renderer. Âncoras com referência ausente são rejeitadas na restauração.
