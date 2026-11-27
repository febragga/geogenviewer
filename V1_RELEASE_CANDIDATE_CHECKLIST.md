
# GeoGenViewer — checklist de homologação V1.0

**Candidata 0.9.12.** Escopo funcional congelado após a Sprint C. A homologação da V1.0 depende da evidência manual com modelos e dispositivos autorizados.

| Categoria | Critério | Responsável | Evidência esperada |
| --- | --- | --- | --- |
| Automação | Lint, TypeScript, testes unitários e integração | Engenharia | Matriz atual da Sprint C com comandos reproduzíveis. [Auditoria](SPRINT_C_RELEASE_AUDIT.md) |
| Automação | Playwright, axe, build e smoke test Next de produção | Engenharia e design | Build de produção, regressão de workspaces e auditoria axe. [Matriz](SPRINT_C_RELEASE_AUDIT.md) |
| Revisão técnica | Limites de importação, contratos CAD e documentos auxiliares, privacidade e dependências | Engenharia | Auditorias de engenharia, segurança e interoperabilidade |
| Revisão técnica | Contexto WebGL, render sob demanda, descarte, alinhamento, clipping e picking | Engenharia | Recursos, tempos medidos e fallback no renderer. [Desempenho](SPRINT_C_PERFORMANCE_REPORT.md) |
| Revisão técnica | Home, contraste, teclado, touch e localização do foco | Design e engenharia | Capturas por resolução e verificação manual |
| Homologação pendente | Exportar e abrir um pacote real no Rhino 8, incluindo SHA-256, milímetros, eixos, GUIDs, blocos e compósitos | Responsável e GeoGenExporter | GLB e manifesto autorizados, relatório de diferenças e versão do exportador |
| Homologação pendente | Tablet e smartphone reais, retrato e paisagem, gestos, seleção, corte, passos e captura | Responsável e design | Dispositivo, sistema, browser, DPR, gravação e resultados sem dados privados |
| Homologação pendente | Modelo autorizado da Casa Gerassi e comparação de protótipos | Responsável | Validação de correspondência, quantitativos e proveniência em ambiente autorizado |
| Homologação pendente | Apresentação de montagem e restauração da sessão | Responsável | Roteiro executado em apresentação real e registro de pendências |
| Homologação pendente | Smoke no ambiente de preview, revisão dos arquivos públicos e decisão sobre deploy final | Responsável e engenharia | URL de preview, confirmação de privacidade e aceite explícito |

## Roteiro de aceite manual

- [ ] Registrar hash do merge, versão do exportador, versão do navegador, dispositivo e perfil gráfico.
- [ ] Abrir GLB sozinho e GLB com manifesto autorizados. Conferir GUIDs, PartIDs duplicados, nomes CAD, escala, composição e contagem. Comparar Resumo e quantitativos com a fonte.
- [ ] Buscar, selecionar, isolar, agrupar, cortar e medir. Repetir em retrato e paisagem. Conferir retorno de Knolling e Explodir às poses esperadas e restauração de uma vista salva.
- [ ] Passar pelos quatro modos no mesmo enquadramento. Comparar contornos de Mono, controles do Blueprint, padrão de Dither e contatos do Clay. Medir o preset habitual e Desempenho.
- [ ] Exportar PNG opaco e transparente em perspectiva e ortográfica. Auditar lajes, vigas, encaixes, sombras, alfa e a captura documental com callouts. Registrar as diferenças relevantes.
- [ ] Confirmar o aceite dos fluxos, a privacidade dos arquivos de teste e a decisão de promoção à V1.0.

[Regressão reproduzível](SPRINT_C_RELEASE_AUDIT.md) · [Interoperabilidade](V091_INTEROPERABILITY_REPORT.md) · [Limitações](KNOWN_ISSUES.md)
