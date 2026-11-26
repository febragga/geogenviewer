# GeoGenViewer V0.8 — relatório de implementação

Knolling e Catálogo acrescentam organização visual, identificação e documentação por ocorrência aos fluxos existentes. Ambos usam o renderer da viewport. O laboratório sintético traz duas revisões, hierarquia, grupos sobrepostos, tipos inconsistentes, montagem e medidas de referência.

## Arquivos e decisões

- `geogenviewer/src/lib/geogen/documentation/` implementa catálogo, disposição, poses, callouts, fichas e documentos.
- `geogenviewer/src/features/viewer/state/documentation-workspace.ts` reúne escopo, seleção, fabricação, comparação e configuração por revisão.
- `geogenviewer/src/features/viewer/scene/documentation-renderer.tsx` enfileira miniaturas e vistas da peça em alvos offscreen no Canvas existente.
- Os painéis de documentação e as fichas ficam em `geogenviewer/src/features/viewer/components/`. Os estilos contextuais usam tokens do visualizador.
- O schema auxiliar e o laboratório ficam em `geogenviewer/schemas/` e `geogenviewer/public/demos/catalog-lab/`. A configuração Vercel continua usando a aplicação em `geogenviewer/`.

## Documentação e evidências

- [Auditoria](V08_KNOLLING_CATALOG_AUDIT.md) · [Motor e geometria](V08_KNOLLING_ENGINE_SPEC.md) · [Catálogo](V08_CATALOG_SPEC.md)
- [Callouts](V08_CALLOUT_SPEC.md) · [Fichas e montagem](V08_DOCUMENTATION_SPEC.md) · [Guia de uso](V08_USER_GUIDE.md)
- [Testes](V08_TEST_REPORT.md) · [Desempenho](V08_PERFORMANCE_REPORT.md)
- [Schema](geogenviewer/schemas/documentation-v1.schema.json) · [Exemplos exportados](docs/v08/examples/) · [Capturas](docs/v08/evidence/)

## Limitações e continuidade

Caixas conservadoras tratam a separação no plano final. A orientação mais longa é heurística e a documentação deriva de malha. A imagem impressa depende do processo de impressão. O manual imprimível inclui índice, inventário, knolling geral, fichas ilustradas das primeiras 20 etapas e dados da sequência. Um compilador próprio de PDF multipágina, checklist de produção e orientação por PCA ficam como extensões. A emulação touch e os arquivos sintéticos cobrem o desenvolvimento local. Homologações com tablet físico, Rhino 8 e dados reais autorizados permanecem pendentes.

Na V0.9, a análise de custo de quadros deve focar contagem de desenhos, poses de muitos objetos, frequência da projeção de labels e reuso de contornos e materiais. O cabeçalho da home e o refinamento do cubo de navegação pertencem à revisão global de interface.
