
# GeoGenViewer V0.9.1 — interoperabilidade com GeoGenExporter

O contrato CAD permanece em `1.0.0`. O pacote envolve GLB 2.0 em RH_Y_UP e metros, mais manifesto. `sourceOrigin`, escala de maquete, materiais, propriedades CAD e proveniência seguem o significado definido pelo contrato.

`extras.geogenElementId` continua sendo a estratégia preferida. As alternativas por nome exigem identidade exclusiva e raiz de geometria. Compósitos mantêm uma raiz de seleção. Uma instância repetida é distinta por ocorrência e pode compartilhar buffers de geometria. Grupos e camadas pessoais ficam no documento do viewer. A verificação SHA-256 usa o binário bruto entregue e, ao receber manifesto inválido, a interface mantém o modelo atual e oferece um modo básico explícito.

A regressão usa o pacote em `exporter-contract/`, o pavilhão e os laboratórios sintéticos de inspeção, revisão e catálogo. Os cenários incluem identidade duplicada, referência inválida, alteração de arquivo, montagem e transformações de repouso. O README do contrato descreve o intercâmbio com Rhino 8. A instalação efetiva e a homologação dos marcos V0.1–V0.4 do exportador em Rhino 8 dependem de execução externa ao workspace.

[Contrato](EXPORTER_CONTRACT.md) · [Notas anteriores](EXPORTER_VIEWER_INTEROPERABILITY_NOTES.md) · [Homologação](V1_RELEASE_CANDIDATE_CHECKLIST.md)
