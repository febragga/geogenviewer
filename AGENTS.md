# GeoGenViewer — instruções para agentes

**Estado:** proposta inicial v0.1 · 25/11/2026  
**Responsável pelas decisões de produto:** Fernando Braga  
**Aplicação:** `geogenviewer.fernandobragaportfolio.com.br`

## 1. Missão

Desenvolver um visualizador web independente de modelos arquitetônicos e paramétricos, com foco em inspeção por componentes, montagem, fabricação digital e comunicação de projetos. A primeira aplicação é a maquete desmontável da Casa Gerassi. O visualizador deve funcionar com modelos de outras origens, sem depender do Rhino para executar no navegador.

O objetivo imediato é uma demonstração confiável no desktop e no tablet, não um BIM completo nem um novo CAD. Não presumir que funções planejadas já existem.

## 2. Leitura obrigatória antes de editar

1. `AGENTS.md`: regras de trabalho.
2. `HANDOFF.md`: estado real, tarefa ativa, bloqueios.
3. `ARCHITECTURE.md`: decisões e fronteiras técnicas.
4. `DATA_SCHEMA.md`: contrato de intercâmbio.
5. `ROADMAP.md`: prioridade e critérios de aceite.
6. `CRAFTBOT_ANALYSIS.md`: referência externa e limites de reutilização.
7. `DESIGN_SYSTEM.md`, `UI_ARCHITECTURE.md`, `UX_RESEARCH.md` e `DESIGN_TOOLCHAIN.md`: identidade visual, contratos de UI, ergonomia e ferramentas de design/validação local (`ui-ux-pro-max`, `@base-ui/react`, `lucide-react`, `react-resizable-panels`, `vaul`, `cmdk`, `playwright` + `@axe-core/playwright`).

Depois, inspecionar `git status`, árvore de arquivos, dependências e scripts existentes. Não assumir que o projeto já foi inicializado. Em conflito, a instrução explícita mais recente do responsável prevalece; registrar a mudança nos documentos pertinentes. Não alterar o contrato silenciosamente.

## 3. Colaboração Codex + Google Antigravity

| Papel sugerido | Responsabilidade principal |
|---|---|
| Responsável humano | Escopo, decisões de projeto, aprovação de publicação e dados da IC |
| Codex | Contrato de dados, importação, engine, exportador Rhino, testes e revisão |
| Antigravity | UI/UX, responsividade, acessibilidade e testes no navegador |

A divisão é organizacional, não restrição de capacidade. O agente que receber uma tarefa pode atuar nas duas frentes se necessário. Antigravity deve ser instruído a ler explicitamente este arquivo, sem presumir descoberta automática.

- Um agente por tarefa e conjunto de arquivos. Trabalho serial na mesma pasta ou branches/worktrees separados para trabalho simultâneo.
- Usar `main` como base estável; branches `feat/<tema>`, `fix/<tema>`, `docs/<tema>`; commits pequenos e descritivos. Não reescrever histórico compartilhado.
- Não desfazer mudanças de outro agente. Se houver alterações concorrentes nos mesmos arquivos, interromper a integração e relatar o conflito.
- Registrar em `HANDOFF.md` o que mudou, testes executados, limitações e próximo passo. O estado de passagem não substitui Git.
- Não fazer push, merge, deploy de produção, mudança de DNS, exposição de dados ou alteração de segredos sem autorização específica. Não inventar credenciais.

## 4. Regras técnicas

- Next.js (App Router), TypeScript estrito, Three.js via React Three Fiber, Drei quando útil; Zustand para estado compartilhado. Verificar compatibilidade real das versões e manter lockfile; evitar dependências redundantes.
- Isolar domínio, importadores, renderer, estado e interface. Nada de regras de montagem diretamente em componentes visuais.
- Preferir GLB para malhas e JSON versionado para semântica; dados de origem e transforms de repouso são imutáveis. Preservar IDs, unidades, hierarquia e instâncias. Nunca confundir dimensões de fabricação com bounding boxes.
- Importação local em primeiro lugar: não enviar arquivos, telemetria ou metadados do usuário a serviços externos sem autorização. Não colocar conteúdo da IC em `public/` ou em fixtures versionadas.
- Usar geometria de teste sintética. Não inventar medidas ou conexões reais da Casa Gerassi.
- Não introduzir autenticação, banco de dados, IA, Rhino Compute, IFC ou backend de processamento no MVP sem necessidade aprovada.
- Não otimizar por fusão indiscriminada: manter seleção individual e correspondência de IDs. Liberar recursos GPU, URLs temporárias e listeners ao trocar o modelo.
- Interface em português inicialmente, textos centralizados para futura internacionalização. Tema neutro com azul claro como acento; usabilidade touch e teclado, contraste legível, sem animações que bloqueiem tarefas. Primitivos de UI seguem `@base-ui/react` + CSS puro com `light-dark()` (alinhados ao portfólio; não misturar Radix UI com Base UI nem introduzir dependências redundantes).
- Não copiar código, imagens ou dados externos sem verificar licença e origem. Para código MIT reutilizado, conservar avisos e registrar procedência e commit.

## 5. Fluxo de execução

1. Inspecionar o estado real e definir um resultado verificável.
2. Propor mudanças e arquivos afetados; para decisões estruturais, registrar alternativas e justificativa em `ARCHITECTURE.md`.
3. Implementar uma fatia vertical pequena, incluindo erros, estados vazios e limpeza de recursos.
4. Executar os scripts existentes de lint, typecheck, teste e build; se inexistentes, registrar ou adicioná-los quando couber à tarefa. Não declarar aprovação de testes que não rodaram.
5. Fazer smoke test em navegador para alterações visuais; em tablet real quando disponível. Testes em emulação não equivalem a dispositivo físico.
6. Atualizar documentação e handoff. Informar diff/resumo, comandos e resultados, riscos e próxima ação.

## 6. Definição de pronto

- Critérios da etapa em `ROADMAP.md` atendidos, ou exceções documentadas.
- Código com tipos e testes coerentes; build e verificações sem falhas conhecidas não explicadas.
- Sem regressão de importação, seleção, navegação ou isolamento de dados.
- Nenhum segredo, arquivo acadêmico privado, binário desnecessário ou dependência de licença não revisada no commit.
- Nenhuma alegação de validação estrutural, tolerância de encaixe ou precisão CAD baseada apenas no renderer.
- `HANDOFF.md` atualizado e escopo não ampliado por conta própria.
