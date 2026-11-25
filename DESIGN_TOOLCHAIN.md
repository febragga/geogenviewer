# GeoGenViewer — Design Toolchain e Stack de Interface

**Revisão:** 0.1 · 25/11/2026  
**Responsável:** Antigravity (Product Design & Frontend Engineering)  
**Objetivo:** registrar as ferramentas de design, servidores MCP, bibliotecas de interface e ferramentas de auditoria visual investigadas, instaladas ou rejeitadas na Sprint 02.1, garantindo reprodutibilidade entre Antigravity e Codex.

---

## 1. Skills de design investigadas e configuradas

| Ferramenta | Versão / Origem | Escopo e instalação | Status | Uso e restrições |
|---|---|---|---|---|
| **UI/UX Pro Max** | `ui-ux-pro-max-cli@2.5.0` ([nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), MIT) | Instalada localmente no repositório em `.agents/skills/ui-ux-pro-max/` via `npx --yes ui-ux-pro-max-cli@latest init --ai antigravity` (requer Python 3.x local; verificado `Python 3.15.2`) | **Instalada (Local)** | Inteligência de UX, densidade CAD, regras de contraste, espaçamento touch (`>= 8px` entre alvos) e checklist de acessibilidade. **Regra:** suas paletas/fontes genéricas não sobrescrevem a identidade visual do portfólio. |
| **Superdesign** | `@superdesign/cli@0.14.0` ([superdesigndev/superdesign-skill](https://github.com/superdesigndev/superdesign-skill)) | Já presente localmente no repositório em `.agents/skills/superdesign/` | **Presente (Não autenticada)** | `superdesign auth status` retornou `not authenticated`. Geração/extração em nuvem exige `superdesign login` / créditos e envio de HTML/contexto para servidores externos. Mantida deslogada por política de privacidade (IC / Casa Gerassi) e sem autorização de autenticação externa. |

---

## 2. Servidores MCP investigados

| Servidor MCP | Origem / Custo | Status | Justificativa técnica |
|---|---|---|---|
| **Chrome DevTools MCP** | Integrado ao ambiente Antigravity | **Configurado no host (bloqueado sem `DevToolsActivePort`)** | Requer Chrome em execução com `chrome://inspect/#remote-debugging` ativo. Como alternativa imediata e determinística, foi configurado Playwright local com instância isolada do Chrome/Chromium. |
| **Playwright (`playwright` + `@axe-core/playwright`)** | Pacotes locais npm (substituindo dependência exclusiva de MCP externo) | **Adotado localmente em `geogenviewer/`** | Permite execução scriptada e offline em navegador isolado com WebGL (`--use-angle=swiftshader`), capturas comparativas em desktop/tablet/smartphone e auditoria WCAG automática via `axe-core`. |
| **shadcn/ui MCP** | `npx shadcn@latest mcp` (Gratuito/local) | **Rejeitado no momento** | O GeoGenViewer adota CSS puro com tokens semânticos e `@base-ui/react` alinhados ao portfólio ([febragga/portfolio](https://github.com/febragga/portfolio)), evitando introduzir geradores copy-paste baseados em Tailwind/Radix. |
| **21st.dev Magic MCP** | `@21st-dev/magic` (Conta/token para geração) | **Rejeitado** | Foco em blocos de landing page Tailwind e dependência de serviço externo/token para geração. |
| **Figma MCP** | Requer conta Figma (Dev/Full seat) e token | **Rejeitado no momento** | Não há arquivo Figma ativo no fluxo da v0.1 e exigiria autenticação externa sem benefício prático imediato. |

---

## 3. Dependências frontend e de QA avaliadas (`geogenviewer/package.json`)

Todas as bibliotecas instaladas foram verificadas previamente quanto à compatibilidade com **React `19.3.0`** e **Next.js `16.4.6`**, licença permissiva e alinhamento direto com a stack do portfólio de referência ([febragga/portfolio](https://github.com/febragga/portfolio)).

### 3.1 Instaladas e justificadas

| Pacote | Range (`package.json`) | Versão exata instalada (`node_modules`) | Licença | Tipo | Justificativa e papel no GeoGenViewer |
|---|---|---|---|---|---|
| `lucide-react` | `^1.80.0` | `1.80.0` | ISC | `dependencies` | Substitui ícones SVG manuais por conjunto vetorial uniforme (stroke 1.75) com tree-shaking por ícone, mantendo apenas a marca geométrica própria em SVG. |
| `@base-ui/react` | `^1.9.0` | `1.9.0` | MIT | `dependencies` | Primitivos headless acessíveis (`Tooltip`, `Menu`, `Dialog`) nativos para React 19, mesmo padrão do portfólio de Fernando Braga, estilizados diretamente com as variáveis CSS do projeto. |
| `react-resizable-panels` | `^4.24.3` | `4.24.3` | MIT | `dependencies` | Redimensionamento real por mouse e teclado (`Group`, `Panel`, `Separator`) para os painéis laterais `Estrutura` e `Propriedades` em desktop (`>= 1024px`) sem deformar o canvas WebGL. |
| `vaul` | `^1.1.2` | `1.1.2` | MIT | `dependencies` | Bottom sheet com gesto de arraste e backdrop acessível para smartphone (`< 768px`), mesmo padrão adotado no portfólio de referência. |
| `cmdk` | `^1.1.1` | `1.1.1` | MIT | `dependencies` | Paleta de comandos (`Ctrl+K` / `⌘K`) para acesso rápido por teclado aos comandos reais da v0.1, replicando a fluidez de interface do portfólio e do Linear. |
| `playwright` | `^1.65.1` | `1.65.1` | Apache-2.0 | `devDependencies` | Execução isolada de Chromium/Chrome para validação visual multi-viewport e testes E2E sem depender da sessão principal do Chrome do usuário. |
| `@axe-core/playwright` | `^4.14.1` | `4.14.1` | MPL-2.0 | `devDependencies` | Auditoria automatizada de acessibilidade WCAG 2.1 AA (contraste, rótulos, landmarks, semântica) integrada à verificação visual. |

### 3.2 Bibliotecas avaliadas e rejeitadas

| Biblioteca | Licença | Motivo da rejeição |
|---|---|---|
| **Radix UI (`@radix-ui/react-*`)** | MIT | Redundante com `@base-ui/react`; a regra explícita do portfólio de referência proíbe misturar Radix e Base UI para os mesmos primitivos. |
| **shadcn/ui** | MIT | Pressupõe Tailwind CSS e estrutura de componentes copiados; o GeoGenViewer usa CSS puro com `light-dark()` e zero dependência de Tailwind no runtime. |
| **Motion (`motion` / `framer-motion`)** | MIT | Transições nativas de CSS (`transform`/`opacity` com `--gg-ease-out` e `data-starting-style` do Base UI) cobrem tooltips, menus, dialogs e hover sem adicionar peso de JS ou risco de re-render próximo ao loop R3F. |
| **Magic UI / Aceternity UI** | MIT / Variada | Voltadas a efeitos decorativos de landing pages SaaS (brilhos, gradientes, animações contínuas), incompatíveis com a sobriedade de um visualizador CAD. |

---

## 4. Referência visual aplicada do portfólio

A inspeção pública de [fernandobragaportfolio.com.br](https://www.fernandobragaportfolio.com.br/) e [github.com/febragga/portfolio](https://github.com/febragga/portfolio) (`main-site/styles/globals.css`, `ui-system.css`, `GEMINI.md` e `UI_AUDIT.md`) consolidou a linguagem **Architectural Editorial UI** adaptada ao GeoGenViewer:

- **Tema Escuro (derivado do portfólio):** fundo `#0C0D0E`, superfícies em camadas `#17191A` e `#202223`, bordas estruturais `1px` em `#343637`, textos `#F1F1EE` / `#B4B8B7` / `#949897` e acento **azul-gelo** (`#B5DAF2` / interativo `#89C8FA`).
- **Tema Claro (derivado da prancha técnica `#EDF0F3` em `UI_AUDIT.md`):** fundo `#E6EAF0`, viewport `#EDF0F3`, painéis `#F8F9FB`, bordas `#D3DAE3` e acento azul-aço calibrado (`#1D5F82`, `>= 5.2:1` WCAG AA).
- **Assinatura gráfica:** marcadores `.gg-section-index` (losango `7×7px` rotacionado em 45°), rótulos técnicos monoespaçados (`Geist Mono` / `ui-monospace`) e grade arquitetônica discreta na página inicial `/`.

---

## 5. Instruções de uso para o Codex e próximos sprints

1. **Consultar UI/UX Pro Max localmente (sem rede):**
   ```powershell
   python .agents/skills/ui-ux-pro-max/scripts/search.py "<termo>" --domain ux
   python .agents/skills/ui-ux-pro-max/scripts/search.py "<termo>" --stack react
   ```
   *(Sempre preservar os tokens de `geogenviewer/app/globals.css` e nunca substituir pela paleta padrão da skill.)*

2. **Executar verificação padrão + auditoria visual/WCAG local:**
   ```powershell
   npm --prefix geogenviewer run lint
   npm --prefix geogenviewer run typecheck
   npm --prefix geogenviewer run test
   npm --prefix geogenviewer run build
   npm --prefix geogenviewer run test:ui
   ```
   O script preservado em `geogenviewer/scripts/verify-ui.mjs` (`npm run test:ui`) inicia `next start` localmente, captura screenshots em `geogenviewer/test-results/ui-audit/` (ignorado no `.gitignore`) e falha caso haja erros de console, requisições externas, overflow horizontal, sobreposição da toolbar/eixos ou violações `axe-core`. Para Chrome/Chromium, usa `channel: "chrome"` com `--use-gl=angle --use-angle=swiftshader --enable-webgl` (ou `npx playwright install chromium` se não houver Chrome no ambiente).

3. **Política para ferramentas externas (Superdesign / Figma):**
   Não executar `superdesign login`, `extract-website` em conteúdo privado ou configurar servidores MCP que enviem modelos da Casa Gerassi ou código da IC para serviços externos sem autorização explícita do Product Owner.
