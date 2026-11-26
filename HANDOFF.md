
# GeoGenViewer — handoff

- **Versão da aplicação:** `0.9.11`
- **Data:** 26/11/2026
- **Base auditada:** `e83ad98`, V0.9.0 do Gemini. Branch da auditoria `fix/v0.9.1-engineering-audit`.
- **Responsável pelas decisões:** Fernando Braga

## Estado

A V0.9.11 remove os links públicos do GitHub da navegação da Home e da aba **Sobre** nas Configurações. A referência técnica `GEOGEN_REPO_URL` continua disponível e o contrato CAD JSON segue na versão `1.0.0`.

A V0.9.1 preserva a home, o cubo SVG e o sistema visual anterior. Corrige domínio, persistência, importação, cancelamento e seleção/picking GPU. Mantém um Canvas por sessão de visualização e o contrato de manifesto CAD 1.0.0.

- [Auditoria](V091_ENGINEERING_AUDIT.md) · [Arquitetura](V091_ARCHITECTURE_REVIEW.md) · [Regressão e resultado do build](V091_REGRESSION_REPORT.md) · [Desempenho](V091_PERFORMANCE_REPORT.md)
- [Limites e backlog](KNOWN_ISSUES.md) · [Checklist de homologação](V1_RELEASE_CANDIDATE_CHECKLIST.md)
- [Entrega do Gemini](V09_IMPLEMENTATION_REPORT.md) · [Guia da V0.9](V09_USER_GUIDE.md)

## Verificação local

Na V0.9.11, `lint`, `typecheck`, `test` (73 testes) e `build` passaram. O smoke test no Chrome confirmou a ausência dos links, a navegação da Home em quatro resoluções e os dados restantes da aba **Sobre** em desktop. Os tamanhos de tablet e celular foram emulados.

A regressão da V0.9.1 cobre os oito workspaces em sete suítes. Os perfis de navegador registram SwiftShader e GPU Intel/D3D11, com 2 draw calls em 10.000 ocorrências repetidas e um contexto na vista única. [Testes](V091_REGRESSION_REPORT.md) · [Amostras](V091_PERFORMANCE_REPORT.md)

## Continuidade

A V0.9.11 segue na branch `fix/v0.9.11-public-github-links`, com a tag `v0.9.11`. A integração na `main` e a publicação em produção ficam para uma etapa autorizada pelo responsável. A homologação da V1.0 exige execução com o GeoGenExporter no Rhino 8, dispositivo físico, arquivos autorizados da Casa Gerassi e medição de quad e picking com GPU real.
