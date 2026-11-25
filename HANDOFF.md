# GeoGenViewer — handoff entre agentes

**Última atualização:** 25/11/2026  
**Status:** V0.0 e primeira fatia V0.1 implementadas e validadas localmente.  
**Responsável ativo sugerido:** Antigravity para refinamento da UI.  
**Branch / commit:** `feat/viewer-bootstrap`, ainda sem commit.

## 1. Contexto e decisões

- Aplicação independente do portfólio, com hospedagem futura separada. O primeiro caso real é a maquete desmontável da Casa Gerassi. Apenas a fixture sintética acompanha o projeto.
- A raiz contém os documentos compartilhados com o Antigravity. A aplicação Next.js está em `geogenviewer/`. Ver `ARCHITECTURE.md` para as decisões do bootstrap.
- O fluxo corrente é GLB local. O manifesto versionado, o schema executável e o exportador Rhino continuam no escopo da v0.3.

## 2. Entregáveis disponíveis

| Item | Estado |
|---|---|
| Repositório GitHub | `origin` configurado e consultado. O remoto retornou sem refs |
| Fundação Next.js/TypeScript | Scaffold preservado, npm lockfile e scripts de verificação |
| `/viewer` | Seletor GLB local, demonstração, câmera e estados de erro |
| Fixture | Estrutura sintética com oito elementos e cubo de 100 mm |
| CraftBot | Auditoria estática com SHA e amostra registrada |
| Tablet físico, Rhino, hospedagem e DNS | Validações ou decisões pendentes |

## 3. Tarefa ativa — próxima intervenção do Antigravity

Leia explicitamente `AGENTS.md`, depois a documentação compartilhada, inclusive `DESIGN_SYSTEM.md`, `UI_ARCHITECTURE.md` e `UX_RESEARCH.md`. Refine a UI de `/viewer` dentro da v0.1, mantendo a viewport predominante, botões touch, acesso por teclado e estados operacionais verdadeiros. A entrada de passagem abaixo registra as fronteiras do código e os testes. Trabalhe serialmente ou em branch própria após existir uma base local registrada.

## 4. Pendências

| Pendência | Quando |
|---|---|
| Identidade Git e primeiro commit | Após configuração da autoria local pelo responsável |
| Toque em tablet físico | Quando houver o dispositivo de referência |
| Benchmark comparável do CraftBot e GeoGenViewer | Após definir cenas equivalentes e o dispositivo |
| Schema v1, GLB + manifesto e exportação Rhino 8 | v0.3 |
| Modelo, escala e sequência reais | Após autorização dos dados da IC |
| Hospedagem e DNS | Após autorização e validação de preview |

## 5. Registro de passagem (adicionar uma entrada a cada tarefa)

### 2026-11-25 — documentação inicial
- Agente: ChatGPT (planejamento).
- Branch/commit: não verificado.
- Alterações: seis Markdown de fundação; nenhum código de aplicação.
- Decisões: GLB + manifesto, aplicação independente, local-first, MVP pequeno.
- Verificação: coerência documental e exemplo sintético; software não executado.
- Limitações: workspace não acessado, não há teste real de Rhino/GLB/tablet, não há DNS aplicado.
- Próximo passo: inspecionar projeto e iniciar v0.0.

### 2026-11-25 — pesquisa de UX, design system e arquitetura de UI
- Data / agente: 2026-11-25 / Antigravity (Product Design & Frontend Engineering).
- Tarefa / status: Planejamento e especificação de UI/UX para GeoGenViewer / concluída.
- Branch / commit: `main` (sem commits ainda; `C:\Site-GeoGenViewer\.git` pertencente a `PC2/CodexSandboxOffline`).
- Arquivos modificados: criados `UX_RESEARCH.md`, `DESIGN_SYSTEM.md` e `UI_ARCHITECTURE.md`; atualizado `HANDOFF.md`. Nenhum arquivo de código em `geogenviewer/` foi alterado.
- Decisões e justificativa:
  - Manter `geogenviewer/` no estágio atual sem implementar UI prematura antes da base v0.0/v0.1 do Codex.
  - Adotar linguagem neutra com acento azul-claro/azul-acinzentado (`#256F96` claro / `#5BAAD4` escuro), suporte equivalente a Light/Dark, fontes `Geist` + `Geist_Mono` já presentes e alvos touch `>= 44×44 CSS px` com foco no tablet da Casa Gerassi.
  - Restringir v0.1 ao que funciona de verdade (Topbar enxuta, dropzone/seletor GLB local, viewport dominante, Toolbar básica e estados de progresso/erro/WebGL perdido), deixando Árvore (v0.2), Inspetor completo/Explode (v0.4) e Timeline (v0.5) sem simulação falsa.
  - Definir contrato desacoplado UI ↔ Scene (`ViewerUIState` sem objetos Three.js no Zustand + `SceneController` imperativo).
- Comandos executados e resultados:
  - `git -C C:\Site-GeoGenViewer status`: retornou `fatal: detected dubious ownership in repository at 'C:/Site-GeoGenViewer'` (`.git` pertence a `PC2/CodexSandboxOffline`, sessão atual `PC2/_`).
  - `git --git-dir=C:\Site-GeoGenViewer\.git --work-tree=C:\Site-GeoGenViewer status`: confirmou `On branch main`, `No commits yet`, arquivos da raiz e `geogenviewer/` não rastreados.
  - Inspeção de arquivos e `node -v` (`v22.14.0`), `npm -v` (`10.9.2`): identificado Next.js `16.4.6`, React `19.3.0`, Tailwind `4.3.3` (`@tailwindcss/turbopack`), `app/` sem `src/`, `next.config.ts` com `cacheComponents: true` e `partialPrefetching: true`, sem `three`/R3F/`zustand`/rotas `/viewer`.
- Testes manuais (dispositivo/viewport): não aplicável nesta etapa documental.
- Limitações / riscos / bloqueios:
  - Código-fonte do CraftBot não clonado localmente (análise baseada em `CRAFTBOT_ANALYSIS.md` e documentação pública).
  - Risco de incompatibilidade se `@react-three/fiber@8` for instalado com `react@19.3.0` (exige R3F v9+).
  - Ausência de `.gitignore` na raiz `C:\Site-GeoGenViewer` para modelos privados (`.3dm`, `.glb`) e aviso de `dubious ownership` no `.git` compartilhado entre ambientes.
- Mudanças que outro agente deve evitar sobrescrever: `UX_RESEARCH.md`, `DESIGN_SYSTEM.md`, `UI_ARCHITECTURE.md` e documentos fundacionais na raiz sem alinhamento.
- Próxima ação concreta: Codex concluir v0.0 e primeira fatia v0.1 (verificar `.gitignore` na raiz e commit inicial, adicionar scripts `typecheck`/`test`, validar R3F v9 + `next/dynamic(..., { ssr: false })`, criar fixture sintética com cubo `100 mm` e expor contrato `SceneController` / Zustand para Antigravity implementar a UI responsiva da v0.1).

### Modelo para próxima entrada

```text
Data / agente:
Tarefa / status (planejada, em andamento, bloqueada, concluída):
Branch / commit:
Arquivos modificados:
Decisões e justificativa:
Comandos executados e resultados (incluindo falhas):
Testes manuais (dispositivo/viewport):
Limitações / riscos / bloqueios:
Mudanças que outro agente deve evitar sobrescrever:
Próxima ação concreta:
```

Não colocar senhas, tokens, caminhos de arquivos privados desnecessários ou dados acadêmicos neste histórico. Handoff deve permanecer curto e factual; mover histórico antigo para arquivo separado se crescer excessivamente.

### 2026-11-25 — bootstrap V0.0 e primeira fatia V0.1

- **Agente e estado:** Codex. Fundação e visualizador básico implementados localmente no scaffold `geogenviewer/`. Os documentos do Antigravity na raiz foram preservados.
- **Git:** `origin` configurado como `https://github.com/febragga/geogenviewer.git`. A consulta de leitura ao remoto retornou sem refs. Branch local inicial `feat/viewer-bootstrap`, ainda sem commit por falta de `user.name` e `user.email` configurados. A conta Windows marcou apenas `C:/Site-GeoGenViewer` como `safe.directory` por diferença de propriedade do diretório `.git` criado no sandbox. Publicação, merge e deploy aguardam autorização específica.
- **Entrada e fronteiras:** `app/viewer/page.tsx` monta `src/features/viewer/viewer.tsx`, responsável pelo seletor, estados, troca de arquivo e ações. Textos em `src/features/viewer/copy.ts`. `scene/viewport.tsx` recebe `ImportedModel`, comando de câmera e modo de navegação. O importador em `src/lib/geogen/importers/glb.ts` valida o GLB e devolve `{ scene, bounds, dispose }`. Preservar a responsabilidade de descarte ao alterar a UI.
- **Demonstração:** `public/demos/estrutura.glb` é gerado por `npm run fixture`. Contém oito nós independentes, geometria compartilhada e cubo de 100 mm. O visualizador abre a demo pelo botão dentro de `/viewer`.
- **Verificação:** instalação limpa com `npm ci --no-fund`, seguida de `npm run lint`, `npm run test` (2 testes), `npm run build` e `npm run typecheck`. O Chrome headless com SwiftShader testou desktop em 1280×850 e tablet emulado em 820×1180. Verificados GLB local, órbita, zoom, pan por toque, teclado, enquadramento, reset, modelo inválido, troca de arquivo e recuperação após perda de WebGL. Na importação local o monitor de rede observou apenas GETs de recursos da aplicação. O teste unitário valida o descarte da geometria compartilhada.
- **Auditoria e limites:** CraftBot auditado estaticamente na revisão registrada em `CRAFTBOT_ANALYSIS.md`. Benchmark, tablet físico, ensaio com Rhino real e validação executável do manifesto estão pendentes. O importador básico aceita GLB 2.0 autocontido de até 100 MiB, com os codecs obrigatórios Draco, Meshopt e Basis adiados. A barra de estado indica leitura e preparação, em vez de porcentagem estimada. O npm emite aviso de fim de suporte do ESLint 9 do scaffold. O teste Node emite aviso de type stripping experimental. No Chrome headless, as dependências emitiram aviso de depreciação de THREE.Clock e aviso de WEBGL_lose_context em descarte de contexto. A recuperação da cena passou no smoke test.
- **Próxima ação para o Antigravity:** ler explicitamente `AGENTS.md` e os documentos compartilhados. Refinar a UI dentro do escopo v0.1, mantendo a API do viewport, a importação local e os testes. Repetir os fluxos em tablet físico quando disponível. Trabalhar serialmente ou em branch própria após existir uma base local registrada.
