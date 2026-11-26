# IMPORT_PIPELINE.md — Pipeline de Importação Local (V0.2 e V0.3)

**Estado:** Implementado e verificado em testes automatizados · Sprint 03  
**Escopo:** Contrato GLB + Manifesto JSON v1.0, validação estrita e segurança local-first.

## 1. Fluxo de Importação no Navegador

1. **Entrada local (`viewer.tsx`)**:
   - Aceita seleção múltipla via `<input type="file">` ou arraste e solte (`drag-and-drop`) com 1 arquivo `.glb` (até 100 MiB) isolado ou acompanhado de 1 manifesto `.json` (até 10 MiB).
   - Recusa envio isolado de `.json` sem `.glb` correspondente e múltiplos arquivos `.glb` simultâneos.
   - Todo o processamento ocorre no cliente; nenhuma requisição de rede externa é feita.

2. **Validação binária e sanitização GLB (`src/lib/geogen/importers/glb.ts`)**:
   - Validação de cabeçalho GLB 2.0, comprimento de chunks, JSON válido, detecção de ciclos na hierarquia de nós e bloqueio de URIs externos e extensões de compressão não suportadas sem decoder.

3. **Validação estrutural e semântica do Manifesto (`src/lib/geogen/validation/manifest.ts`)**:
   - Decodificação estrita UTF-8 (`TextDecoder("utf-8", { fatal: true })`) e parse JSON seguro.
   - Validação executável JSON Schema Draft 2020-12 via `ajv` (`schemas/manifest-v1.schema.json`).
   - Regras semânticas além do schema:
     - Verificação de versão SemVer compatível (`major === 1`, `minor <= 0`); rejeita versões incompatíveis via `UNSUPPORTED_MAJOR_VERSION` e `UNSUPPORTED_MINOR_VERSION`.
     - Rejeição de valores `NaN`/`Infinity` e detecção de conteúdo HTML/script inseguro (`<script>`, URIs `javascript:`, event handlers inline).
     - Unicidade de IDs em `layers[]`, `groups[]`, `materials[]`, `blocks[]`, `elements[]` e `assembly.steps[]`.
     - Integridade referencial (`layerId`, `groupIds[]`, `materialId`, `blockDefinitionId`, `connectorIds[]`, `assembly.steps[].elementIds[]`, `dependsOn[]`) e detecção de ciclos em hierarquias de componentes e layers.
     - Consistência física: superfícies abertas (`isClosed === false`) com `volumeM3` não nulo são rejeitadas; `boundingBoxM.min <= max` obrigatório.

4. **Vínculo GLB ↔ Manifesto e Integridade SHA-256 (`src/lib/geogen/importers/package.ts`)**:
   - Quando `geometry.sha256` está presente, calcula `SHA-256` via Web Crypto API e rejeita divergência (`SHA256_MISMATCH`).
   - Estratégias suportadas em `geometry.nodeMatchStrategy`:
     - `extras` (padrão): busca `userData.geogenElementId` único por elemento raiz.
     - `nameExact`: vincula por nome exato (`glbNodeName` ou `name`), falhando em caso de ausência ou ambiguidade.
     - `namePrefix`: vincula por prefixo único de nome.
   - **Sem fallback silencioso:** se o manifesto falhar na validação, integridade ou vínculo de nós, a UI exibe o diagnóstico detalhado e só carrega o GLB em modo básico mediante clique explícito do usuário em **"Abrir somente o GLB (modo básico)"**.

5. **Modo GLB Básico (`importGlbBasicPackage`)**:
   - Mantém compatibilidade total com arquivos `.glb` sem manifesto.
   - Preserva `userData.geogenElementId` quando presente, agrupa sub-malhas sob raízes compostas, marca geometrias compartilhadas como instâncias, gera chaves determinísticas para nós sem ID e desambigua duplicatas com registro de diagnóstico.

6. **Contrato do Exportador Externo Rhino 8 (`exporter-contract/`)**:
   - Pacote completo entregue para o desenvolvimento externo do `GeoGenExporter`:
     - `exporter-contract/EXPORTER_CONTRACT.md`
     - `exporter-contract/DATA_SCHEMA.md`
     - `exporter-contract/FORMAT_COMPARISON.md`
     - `exporter-contract/manifest.schema.json`
     - `exporter-contract/manifest.example.json`
     - `exporter-contract/model.example.glb` (e cópias de demo em `geogenviewer/public/demos/contrato-exemplo.*`)
