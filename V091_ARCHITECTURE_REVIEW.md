
# GeoGenViewer V0.9.1 — revisão de arquitetura

| Fronteira | Autoridade e ciclo de vida |
| --- | --- |
| Importadores GLB e CAD | Pré-validação de bytes e JSON, hash, schema, referências e vínculo exclusivo de malha. `LoadedScenePackage` mantém hierarquia e mapa de propriedade |
| Identidade e repouso | A revisão captura matrizes de repouso, metadados, IDs de ocorrência e referências de malha. Revisão em memória e identidade persistente têm chaves distintas |
| Seleção, visibilidade e vistas | Zustand guarda IDs e preferências. Cada região pode usar seleção e visibilidade próprias. Vistas usam o acesso de câmera ativo e validam referências na restauração |
| Explode, Assembly e Knolling | Cada controlador aplica pose temporária e restaura o repouso ao sair. A amostragem de Assembly usa a timeline autorada. A comparação e fichas usam representações de repouso próprias |
| Inspeção | Clipping e reconstrução de ancoragem vivem no renderer. O documento independente mantém coordenadas, unidades e proveniência |
| Comparação, Quantitativos e Fabricação | A comparação mantém escopos de revisão distintos. O peer usa seus IDs e metadados CAD. Quantitativos deduplicam ocorrências no total e mantêm cobertura |
| Catálogo, callouts e fichas | Instâncias semânticas e chaves de revisão definem o escopo. Editor e miniaturas usam solicitações ao renderer compartilhado |
| Organização e preferências | Documento versionado e separado do CAD. Grupos/pastas usam identidade estável. Histórico imutável de 50 operações por sessão ativa, sem cópias de objetos da cena |

A visibilidade efetiva combina ocultação direta, máscaras de grupos, camada personalizada quando essa origem está ativa, filtros, isolamento e estado de montagem. Mostrar um grupo remove uma máscara. Grupos CAD e pessoais têm chaves qualificados por origem. Máscaras de grupos são estado de apresentação e podem seguir a vista nomeada. A visibilidade estrutural das camadas pessoais segue o documento de organização. O efeito de isolamento da comparação é combinado com o escopo local da revisão primária.

As referências de vistas GLB-only novas usam SHA-256. Chaves históricas de CAD permanecem acessíveis por projeto e revisão, com validação de dados da vista no carregamento. Entradas GLB-only antigas baseadas em nome e tamanho são preservadas no armazenamento e sinalizadas na interface. A aplicação exige identidade para restaurar dados ao modelo correspondente.

`viewer.tsx` e `viewer-panels.tsx` ainda são pontos de composição extensos. A sprint aplicou validação e estado em domínios já existentes. Separar mais os componentes ou migrar stores inteiros exige evidência de regressão ou benefício mensurável.
