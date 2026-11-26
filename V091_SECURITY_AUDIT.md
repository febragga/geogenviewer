
# GeoGenViewer V0.9.1 — segurança e privacidade

O processamento das entradas continua no navegador. A aplicação confere o tamanho, assinatura, versão e chunks GLB. O pré-parser confere formato e referências de cena, profundidade, propriedade de pais e tuplas de transformação finitas. Buffers e imagens devem estar embutidos. A política de URLs do loader aceita recursos locais gerados e URLs de dados até o encerramento da carga.

Chaves de objeto reservadas são rejeitadas antes da mesclagem de extras. Manifestos e organização têm validação de schema e profundidade. Títulos importados são processados como texto. CSV continua usando a neutralização de fórmulas; pranchas e relatórios imprimíveis usam os textos do aplicativo e dados renderizados. Documentos de organização incompatíveis não alteram o estado ativo.

A auditoria npm do lockfile respondeu **0 vulnerabilidades conhecidas**. As dependências permaneceram nas versões da base. O resultado equivale à consulta ao registry no momento da auditoria. A cobertura de rede externa, arquivos válidos/inválidos e recuperação consta no [relatório de regressão](V091_REGRESSION_REPORT.md).

As novas evidências vêm de fixtures sintéticas e de testes de navegador. O repositório mantém exclusões para `.env*`, `*.3dm`, modelos privados, relatórios locais e diretórios de build. A verificação de publicação inclui o diff completo desde a main V0.8.
