# GeoGenViewer — roadmap

**Revisão:** 0.1 · 25/11/2026  
**Estado:** V0.0 concluída e visualizador básico V0.1 validado em desktop e tablet emulado.

## 1. Prioridade

Entregar um visualizador capaz de demonstrar o protótipo da Casa Gerassi em tablet. Não esperar por IA, servidor de geometria, banco de dados ou exportador perfeito para testar a experiência. Usar primeiro GLB sintético e depois um arquivo real autorizado, localmente. As versões são marcos por capacidade, não estimativas de calendário.

| Marco | Escopo | Prioridade | Status |
|---|---|---|---|
| v0.0 | Bootstrap, documentação, fixture | P0 | Concluído localmente |
| v0.1 | GLB local, câmera, reset | P0 | Primeira fatia validada em navegador |
| v0.2 | Seleção, árvore, visibilidade | P0 | A fazer |
| v0.3 | Manifesto e exportador Rhino | P0 | A fazer |
| v0.4 | Vista explodida e propriedades | P0 | A fazer |
| v0.5 | Montagem e sequência explícita | P1 | A fazer |
| v0.6 | Corte, medições, estilos | P1 | A fazer |
| v0.7 | Protótipos, comparações e quantitativos | P2 | A fazer |
| v0.8 | Knolling, catálogo e documentação | P2 | A fazer |
| v0.9 | Desempenho, robustez e acessibilidade | P1 | A fazer |
| v1.0 | Publicação estável e validação | P1 | A fazer |
| v2.x | Parametrização e novos adaptadores | Futuro | Backlog |

Responsividade, segurança e testes são transversais desde a primeira versão; v0.9 é uma rodada de consolidação, não o primeiro teste mobile.

## 2. Critérios de aceite por etapa

### v0.0 — Fundação
- [x] Inspecionar projeto existente; inicializar Next.js/TS apenas se necessário.
- [x] Lockfile, scripts dev/lint/typecheck/test/build e `.gitignore` para modelos privados.
- [x] Fixture GLB sintética com pilares, vigas e laje separados; cubo de referência dimensional.
- [x] Documentação revisada, schema planejado e estado de handoff registrado.

### v0.1 — Visualizador básico
- [x] `/viewer`: abrir GLB via seletor local; nenhuma transferência do modelo.
- [x] Câmera com órbita, pan, zoom, fit e reset; erro e progresso de carga.
- [x] Cubo de 100 mm renderizado em escala consistente; eixos de referência corretos.
- [x] Desktop e viewport de tablet em emulação. Validação em tablet físico pendente.
- [x] Arquivo inválido não trava aplicação; segundo arquivo substitui o primeiro e libera recursos.

### v0.2 — Inspeção
- [ ] Seleção individual por clique/toque e árvore; nomes duplicados não confundem IDs.
- [ ] Ocultar, mostrar, isolar, restaurar; grupos/layers quando disponíveis.
- [ ] Painéis recolhíveis; feedback de elemento selecionado.
- [ ] Seleção permanece coerente após ocultar e restaurar peças.

### v0.3 — Contrato e Rhino
- [ ] `manifest-v1.schema.json` e exemplos válidos/inválidos; validação referencial em código.
- [ ] Importar GLB + manifesto; reportar divergências e rejeitar arquivo incompatível sem fallback silencioso.
- [ ] Exportador Rhino 8 não altera documento, preserva IDs, hierarquias e unidades.
- [ ] Testar cubo de 100 mm, eixos assimétricos, peça rotacionada e instâncias de bloco.
- [ ] Registrar parâmetros de tesselação, relatório de peças omitidas e limites de precisão.
- [ ] Rodar exportador no Rhino real e comparar dimensões de origem; se não disponível, marcar pendente.

### v0.4 — Vista explodida e propriedades (MVP)
- [ ] Slider de 0 a 1; em zero a pose original é recuperada sem deriva, mesmo após 20 ciclos.
- [ ] Vetores por peça quando fornecidos, fallback visual determinístico identificado como heurístico.
- [ ] Propriedades: ID, nome, tipo, camada, material e medidas com fonte/unidade.
- [ ] Abrir modelo de teste da maquete autorizado em tablet; conseguir isolar viga, pilar e laje e mostrar encaixe.
- [ ] O protótipo continua utilizável sem internet depois de carregar a página, enquanto ela permanecer aberta; persistência offline/PWA não é requisito.

### v0.5 — Montagem
- [ ] Timeline com passos autorados, play/pause, scrub e reset; visibilidade consistente ao retroceder.
- [ ] Ordem pilares → vigas → lajes somente quando definida no manifesto do caso; não inferir automaticamente sequência física.
- [ ] Passos com múltiplas peças, validação de dependências e mensagens quando não há sequência.
- [ ] Animar inserções lineares quando fornecidas; não declarar ausência de colisão.

### v0.6 — Inspeção espacial
- [ ] Clipping em três eixos, planos ajustáveis e seleção compatível.
- [ ] Distância ponto a ponto sobre malha, distinguida de medida CAD de origem.
- [ ] Estilos sólido, monocromático e wireframe; avaliar contorno/blueprint sem penalizar tablet.

### v0.7–v0.8 — Fabricação e pesquisa
- [ ] Comparação de duas versões com correspondência de IDs e câmera sincronizada.
- [ ] Quantitativos por instância, material e classe; volume/peso/custo apenas quando dados suficientes.
- [ ] Knolling: disposição organizada sem sobreposição visual, agrupamento por tipos, retorno à montagem.
- [ ] Callouts por peça e documentação vinculada; revisão de conteúdo e permissões.

### v0.9–v1.0 — Estabilização e deploy
- [ ] Medir fixtures e modelo real autorizado; registrar dispositivos, fps, draw calls, tempos e falhas.
- [ ] Testes de acessibilidade, toque, WebGL indisponível, arquivos malformados e troca de modelos.
- [ ] Build de produção e smoke test em URL de preview; configurar CNAME DNS only e HTTPS quando aprovado.
- [ ] Verificar que nenhum dado da IC foi publicado inadvertidamente.
- [ ] Manual curto de uso, exportação, limites e reprodução dos testes.

## 3. Backlog futuro

- Suporte direto a `.3dm` via biblioteca compatível (avaliar fidelidade, tamanho, blocos, WASM e custo de integração).
- Importadores IFC, Blender e Grasshopper; interoperabilidade e versionamento de modelos.
- PWA offline, armazenamento local opcional, compartilhamento autenticado e links por projeto.
- Rhino Compute ou serviço paramétrico, sujeito a licenciamento, custo e segurança.
- Integração com agentes de IA por ferramentas bem delimitadas; nunca execução arbitrária de scripts enviados.
- Encaixes e colisões como análise geométrica separada, validada contra CAD; não deduzir adequação estrutural.

## 4. Ordem operacional para os agentes

Codex começa com v0.0 e fatia v0.1. Antigravity prepara UI responsiva depois que a API do viewer e fixture estiverem definidas. Alternar revisão e integração em vez de concorrência sobre a mesma pasta. A cada marco atualizar `HANDOFF.md`. Manter `main` funcional; adiar recursos P2 se prejudicarem a demonstração.


## Registro de Aceite — Sprint 03 (V0.2 e V0.3) · 25/11/2026

- **V0.2 (Interação geométrica):** concluída com IDs estáveis (`userData.geogenElementId` + chave determinística fallback + suporte a compósitos multi-malha e instâncias), picking por raycasting diferenciando arraste de clique/toque, multi-seleção, destaque não destrutivo, sincronização bidirecional viewport ↔ árvore, árvore hierárquica com abas `Componentes` / `Camadas` / `Grupos`, busca por nome/ID, virtualização acima de 100 linhas, ocultação/isolamento/restauração com estado parcial (`partial`), enquadramento de seleção e propriedades com separação de proveniência (`Malha`, `CAD`, `Manifesto`).
- **V0.3 (Pipeline de importação e contrato Rhino 8):** concluída com entrega prioritária da pasta `exporter-contract/`, comparativo de formatos (`FORMAT_COMPARISON.md`), validação JSON Schema 2020-12 + regras semânticas estritas (`ajv`), verificação `SHA-256`, suporte dual GLB-only e GLB+JSON sem fallback silencioso, testes unitários/integração e benchmark sintético até 10.000 componentes (`PERFORMANCE_REPORT.md`).
- **Fora de escopo respeitado:** explosão (`v0.4`), montagem animada (`v0.5`), planos de corte e medição (`v0.6`) e deploy de produção permanecem reservados.
