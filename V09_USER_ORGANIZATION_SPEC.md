# GeoGenViewer V0.9 — Especificação do Sistema de Organização do Usuário

**Contrato JSON Schema:** `geogenviewer/schemas/organization-v1.schema.json` (`schemaVersion: "1.0.0"`)  
**Domínio e Operações:** `geogenviewer/src/lib/geogen/organization/{model,operations,document}.ts`  
**Store e Histórico:** `geogenviewer/src/features/viewer/state/organization-store.ts`

---

## 1. Separação Estrita de Origens

O sistema preserva o princípio fundamental do projeto: **dados importados do CAD são imutáveis**.

- **Origem `"cad"`:** Lê exclusivamente `ViewerSceneGraph.layers`, `ViewerSceneGraph.groups`, `component.layerId` e `component.groupIds`.
- **Origem `"user"`:** Opera sobre `UserOrganizationDocument`, totalmente independente do manifesto `1.0.0`.
- **Compatibilidade GLB-only:** Modelos `.glb` sem manifesto recebem um documento de organização vinculado ao seu `modelSha256` / chave de revisão e já permitem criação imediata de camadas e grupos personalizados.
- **Ação explícita `Copiar CAD`:** Clona camadas, subcamadas, cores, grupos e atribuições do CAD para a estrutura personalizada sem alterar os dados originais.

---

## 2. Regras Semânticas e Invariantes

1. **Regra de Camada Única por Ocorrência:**
   - `componentLayerAssignments: Record<string, string>` mapeia cada ocorrência para no máximo **uma** camada direta do usuário.
   - Mover ocorrências para uma nova camada sobrescreve a atribuição anterior de forma determinística (`assignOccurrencesToUserLayer`).
2. **Hierarquia Segura com Prevenção de Ciclos:**
   - Camadas e grupos suportam `parentId` até profundidade máxima `MAX_ORGANIZATION_DEPTH = 16`.
   - `wouldCreateCycle()` impede que uma camada se torne filha de si mesma ou de qualquer descendente.
3. **Exclusão Explícita de Camadas (`DeleteLayerStrategy`):**
   - Ao excluir uma camada no painel, um `<dialog>` exige escolha explícita do usuário:
     - **`move-to-parent`:** Move ocorrências vinculadas (e subcamadas) para a camada superior (`parentId`).
     - **`unassign`:** Remove o vínculo de camada das ocorrências (reparentando eventuais subcamadas para manter integridade).
     - **`Cancelar`:** Aborta sem alterar o estado.
4. **Grupos Sobrepostos do Usuário:**
   - `userGroups` armazenam `memberIds[]` independentes; a mesma ocorrência pode pertencer simultaneamente a vários grupos sem restrição de unicidade.
5. **Desfazer / Refazer (`Undo / Redo`):**
   - `useOrganizationStore` mantém pilhas imutáveis `past` e `future` (até 50 passos) cobrindo criação, renomeação, cor, visibilidade, movimentação, atribuição de camada/grupo e importação.

---

## 3. Pontos de Entrada e Integração com Módulos

- **Painel de Estrutura (`viewer-panels.tsx`):** Alternância `"Importada do CAD"` vs `"Personalizada"`, drag-and-drop de ocorrências e camadas, criação rápida, edição de cor, renomeação inline, exportação e importação de `organization.json`.
- **Menu de Contexto (`context-menu.tsx`):** Botão direito na cena 3D ou árvore e botão tátil `⋮` para isolar, ocultar, enquadrar, mover de camada, adicionar/remover grupos ou criar nova camada/grupo com a seleção.
- **Inspector (`viewer-panels.tsx`):** Atribuição direta de camada e chips de grupos em seleção única; resumo de atributos comuns vs divergentes (`Vários (N)`) e atribuição em lote na multiseleção.
- **Filtros e Aparência (`visibility.ts`, `visibility-state.ts`, `display.ts`):** Novos campos `userLayer` e `userGroup` nos filtros; ocultação em tempo real por camada do usuário; modo **Cor por camada** respeita a cor da camada personalizada quando a origem ativa é `"user"`.
- **Quantitativos, Knolling e Catálogo (`quantities.ts`, `catalog.ts`, `documentation-workspace.ts`):** Agrupamento e escopo por `userLayer` e `userGroup`. Em `groupQuantities`, grupos sobrepostos ativam `overlapping: true` e `summarizeQuantities()` deduplica por `occurrence.key` para evitar contagem dupla nos totais globais.
