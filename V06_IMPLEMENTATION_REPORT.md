# GeoGenViewer V0.6 — relatório de implementação

A sprint integra corte, medição e documentação em uma única cena R3F, com um renderer e as mesmas identidades do GLB. Os workspaces Explorar, Explodir e Montagem continuam disponíveis. O workspace Inspecionar ativa a ferramenta de corte. O acesso contextual à inspeção também funciona nos demais workspaces.

| Área | Entregue |
|---|---|
| Corte | Três planos CAD, lado preservado, slider, entrada numérica, manipulador, limites, aparência, reset e configuração por região |
| Representação | Abertura shader, contornos CPU, preenchimento condicionado ao fechamento e modo técnico |
| Picking | Reutilização dos semiespaços do passe ativo para seleção, hover, snap e medição. Caps ficam fora do picking |
| Medição | Distância, Delta XYZ, coordenadas, proveniência, ancoragem local e distinção de poses |
| Preferências | Named Views com layout, cortes e cotas visíveis. Leitura dos registros V0.5 na mesma chave de armazenamento |
| Documentação | PNG técnico com composição de anotação, régua ortográfica e JSON de inspeção versionado |
| Interoperabilidade | GLB original e contrato CAD 1.0.0 preservados. SHA-256 e referências verificadas pelo domínio de inspeção |

## Código e dependências

- `src/lib/geogen/inspection/` implementa os domínios de planos, interseção, medidas, snap e validação.
- `src/features/viewer/scene/` estende os passes existentes por região e faz a composição gráfica. O cache de materiais retém variantes por modo enquanto a opacidade for constante, permitindo regiões técnicas e sombreadas no mesmo quadro.
- `src/features/viewer/state/` adiciona o estado de inspeção e estende Named Views. Os recursos Three.js ficam no scene controller.
- `src/features/viewer/components/` integra os quatro painéis contextuais com Base UI e os tokens existentes.
- `schemas/inspection-v1.schema.json`, `public/demos/inspection-lab.*`, `scripts/` e `tests/v06-inspection.test.mjs` fornecem schema, fixtures, auditoria de navegador, benchmark e testes.

Foram reutilizados Three.js, Ajv, Zustand, Playwright e axe. `LineSegments2` e `LineMaterial` vêm do pacote Three.js instalado. Nenhuma dependência de produção adicional foi necessária.

## Limites

Os cortes são ortogonais. Section Box, oblíquos, hachuras, ângulos, polilinhas, CSV, SVG, undo/redo e captura de todo o layout ficaram fora desta entrega. A captura usa a região ativa e pode reduzir dimensões para os limites do renderer. A homologação do exportador no Rhino 8 e o teste em tablet físico permanecem pendentes.

A V0.7 pode usar as referências de inspeção como entrada para a comparação explícita entre revisões e para quantitativos com proveniência. O roadmap mantém V0.7 e V0.8 com seus marcos existentes.

- [Auditoria e baseline](V06_SPATIAL_INSPECTION_AUDIT.md)
- [Especificação de cortes](V06_SECTION_ENGINE_SPEC.md)
- [Especificação de medição](V06_MEASUREMENT_SPEC.md)
- [Guia de uso](V06_USER_GUIDE.md)
- [Testes e capturas](V06_TEST_REPORT.md)
- [Desempenho](V06_PERFORMANCE_REPORT.md)
