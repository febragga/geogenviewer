
# GeoGenViewer — handoff

- **Versão da aplicação:** `0.9.1`
- **Data:** 26/11/2026
- **Base auditada:** `e83ad98`, V0.9.0 do Gemini. Branch da auditoria `fix/v0.9.1-engineering-audit`.
- **Responsável pelas decisões:** Fernando Braga

## Estado

A V0.9.1 preserva a home, o cubo SVG e o sistema visual anterior. Corrige domínio, persistência, importação, cancelamento e seleção/picking GPU. Mantém um Canvas por sessão de visualização e o contrato de manifesto CAD 1.0.0.

- [Auditoria](V091_ENGINEERING_AUDIT.md) · [Arquitetura](V091_ARCHITECTURE_REVIEW.md) · [Regressão e resultado do build](V091_REGRESSION_REPORT.md) · [Desempenho](V091_PERFORMANCE_REPORT.md)
- [Limites e backlog](KNOWN_ISSUES.md) · [Checklist de homologação](V1_RELEASE_CANDIDATE_CHECKLIST.md)
- [Entrega do Gemini](V09_IMPLEMENTATION_REPORT.md) · [Guia da V0.9](V09_USER_GUIDE.md)

## Verificação local

Lint, TypeScript, 73 testes e build aprovados. A regressão de navegador cobre os oito workspaces em sete suítes. Os perfis de navegador registram SwiftShader e GPU Intel/D3D11, com 2 draw calls em 10.000 ocorrências repetidas e um contexto na vista única. [Testes](V091_REGRESSION_REPORT.md) · [Amostras](V091_PERFORMANCE_REPORT.md)

## Continuidade

O responsável autorizou commit, merge e push da sprint após as verificações. A etapa seguinte exige execução com o GeoGenExporter no Rhino 8, dispositivo físico e arquivos autorizados da Casa Gerassi. Medir quad e picking com GPU real antes de publicar a classificação de V1.0.
