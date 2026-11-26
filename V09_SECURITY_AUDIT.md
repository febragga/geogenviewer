# GeoGenViewer V0.9 — Auditoria de Segurança e Privacidade

**Versão:** v0.9.0 · **Data:** 2026-11-26

---

## 1. Modelo de Ameaça e Fronteiras

O GeoGenViewer processa modelos arquitetônicos, manifestos CAD e organizações do usuário **exclusivamente no navegador**:

- **Zero telemetria e zero upload externo:** Arquivos `.glb`, `manifest.json`, `organization.json`, comparações, análises de fabricação e fichas técnicas nunca são enviados a servidores remotos. Confirmado pela suíte `test:ui` (`externalRequests: []`).
- **Metadados locais de sessão:** `Projetos Recentes` (`geogen:v09:recent-projects`) grava apenas título sanitizado, nome do arquivo, ID de revisão, contagem de componentes e prefixo SHA-256 (máximo de 6 registros), jamais blobs binários ou dados privados da IC.

---

## 2. Endurecimento Implementado e Validado na V0.9

| Superfície | Controle Aplicado | Arquivo / Verificação |
|---|---|---|
| JSON de Organização (`organization.json`) | Validação estrita por Ajv Draft 2020-12 (`additionalProperties: false`, limite `12 MB`, limite de 2.000 camadas/grupos, profundidade máxima 16) | `schemas/organization-v1.schema.json`, `organization/document.ts` |
| Prototype Pollution | Bloqueio explícito de chaves `__proto__`, `constructor` e `prototype` em toda a árvore JSON | `assertSafeTreeJson()` (`tests/v09-product-design.test.mjs`) |
| XSS / Conteúdo HTML ativo | Rejeição de tags `<script>`, `<iframe>`, `<object>`, `<embed>`, `<svg>`, `<style>` e `javascript:` em nomes, rótulos e `recent-projects.ts` | `assertSafeTreeJson()`, `sanitizeText()` |
| Integridade referencial | Detecção de ciclos em `parentId`, IDs duplicados, referências órfãs a camadas inexistentes e normalização de cores `#RRGGBB` | `checkHierarchyIntegrity()`, `wouldCreateCycle()` |
| Compatibilidade de revisão | Verificação de `modelSha256` e `projectId` com filtro seguro de ocorrências inexistentes em revisões divergentes | `checkOrganizationCompatibility()` |
| Cancelamento seguro de carga | `AbortController` + `requestRef` descartam decodificações obsoletas e chamam `pkg.dispose()` evitando uso após cancelamento | `viewer.tsx` (`cancelActiveLoad`) |
| Limpeza GPU e memória | Descarte rigoroso de `InstancedMesh`, materiais customizados, bordas, texturas de render target e restauração das malhas originais | `InstancedBatchManager.dispose()`, `SceneDisplay.dispose()` |
| Exportação CSV | Neutralização contra formula injection (`=`, `+`, `-`, `@`) preservada da V0.7/V0.8 | `reports.ts`, `sheets.ts`, `v08-documentation.test.mjs` |
