
# GeoGenViewer — checklist de homologação V1.0

**Candidato condicional.** O acesso à próxima etapa depende de repetir os fluxos com os materiais e dispositivos autorizados pelo responsável.

| Categoria | Critério | Responsável | Evidência esperada |
| --- | --- | --- | --- |
| Automação | Lint, TypeScript, testes unitários e integração | Engenharia | Lint, TypeScript e 73 testes aprovados. [Regressão](V091_REGRESSION_REPORT.md) |
| Automação | Playwright, axe, build e smoke test Next de produção | Engenharia e design | Build, sete suítes e smoke aprovados. [Evidências](docs/v091/evidence/) |
| Revisão técnica | Limites de importação, contratos CAD e documentos auxiliares, privacidade e dependências | Engenharia | Auditorias de engenharia, segurança e interoperabilidade |
| Revisão técnica | Contexto WebGL, render sob demanda, descarte, alinhamento, clipping e picking | Engenharia | Perfis sintéticos em SwiftShader e Intel/D3D11. [Desempenho](V091_PERFORMANCE_REPORT.md) |
| Revisão técnica | Home, contraste, teclado, touch e localização do foco | Design e engenharia | Capturas por resolução e verificação manual |
| Homologação pendente | Exportar e abrir um pacote real no Rhino 8, incluindo SHA-256, milímetros, eixos, GUIDs, blocos e compósitos | Responsável e GeoGenExporter | GLB e manifesto autorizados, relatório de diferenças e versão do exportador |
| Homologação pendente | Tablet e smartphone reais, retrato e paisagem, gestos, seleção, corte, passos e captura | Responsável e design | Dispositivo, sistema, browser, DPR, gravação e resultados sem dados privados |
| Homologação pendente | Modelo autorizado da Casa Gerassi e comparação de protótipos | Responsável | Validação de correspondência, quantitativos e proveniência em ambiente autorizado |
| Homologação pendente | Apresentação de montagem e restauração da sessão | Responsável | Roteiro executado em apresentação real e registro de pendências |
| Homologação pendente | Smoke no ambiente de preview, revisão dos arquivos públicos e decisão sobre deploy final | Responsável e engenharia | URL de preview, confirmação de privacidade e aceite explícito |

[Regressão reproduzível](V091_REGRESSION_REPORT.md) · [Interoperabilidade](V091_INTEROPERABILITY_REPORT.md) · [Backlog](KNOWN_ISSUES.md)
