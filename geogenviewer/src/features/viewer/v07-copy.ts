import type { Change, DiffStatus } from "../../lib/geogen/revisions/diff";
import type { MatchMethod } from "../../lib/geogen/revisions/matching";
import type { Grouping, QuantityScope } from "../../lib/geogen/revisions/quantities";
import type { CompareMode } from "./state/revision-workspace";

export const v07 = {
  compare: "Comparar", quantities: "Quantitativos", base: "Revisão base", comparison: "Revisão comparada",
  revisionLab: "Laboratório de revisões", revisions: "Revisões carregadas", load: "Carregar revisão",
  replace: "Substituir", remove: "Remover", reverse: "Inverter revisões", chooseBase: "Abra um GLB para iniciar a comparação.",
  project: "Projeto", revision: "Revisão", prototype: "Protótipo", scale: "Escala", source: "Origem CAD",
  hash: "SHA-256 do GLB", unknown: "Indisponível", original: "Aparência original", diffColors: "Cores das diferenças",
  glbOnly: "GLB sem manifesto", verified: "Manifesto validado e hash verificado", manifest: "Manifesto validado",
  loading: "Carregando revisão…", loadingAnalysis: "Calculando análise…",
  associate: "Associar projetos para comparação", associationRequired: "Confirme a associação entre os projetos ou arquivos antes de comparar componentes.",
  originAvailable: "Referencial CAD comum disponível", originMissing: "Referencial de origem sem confirmação. As posições usam o alinhamento local exibido.",
  scaleWarning: "As revisões têm escalas físicas diferentes. As dimensões modeladas foram preservadas.",
  kindWarning: "Os tipos de geometria das revisões diferem.",
  alignment: "Alinhamento e tolerância", sourceAlignment: "Usar origem CAD", resetAlignment: "Restaurar alinhamento",
  translation: "Translação da revisão comparada", rotation: "Rotação da revisão comparada em graus",
  tolerance: "Tolerância geométrica", viewing: "Exibição", sync: "Sincronizar orientação das câmeras",
  context: "Mostrar inalterados em transparência", visibility: "Mostrar revisão", opacity: "Opacidade",
  status: "Estado da diferença", differences: "Diferenças", all: "Todos", search: "Pesquisar componentes",
  prev: "Anterior", next: "Próximo", noResults: "Nenhum componente neste escopo.",
  manual: "Correspondência manual", manualApply: "Associar peças", replacement: "Marcar como substituição",
  unmatch: "Marcar peça como sem correspondência", undo: "Desfazer associação", useSuggestion: "Confirmar sugestão",
  baseId: "ID da peça base", nextId: "ID da peça comparada", properties: "Propriedades comparadas",
  noProperties: "Selecione uma diferença ou uma peça na viewport.", property: "Propriedade", delta: "Diferença",
  inspections: "Registros de inspeção", loadInspection: "Carregar inspeção", invalid: "Referência indisponível",
  missingReference: "Peça removida da revisão comparada", acceptMeasurement: "Confirmar equivalência da medição",
  pendingMeasurement: "Aguardando revisão", confirmedMeasurement: "Equivalência confirmada",
  export: "Exportar e restaurar", comparisonJson: "Exportar comparação JSON", comparisonCsv: "Exportar diferenças CSV",
  comparisonPng: "Exportar comparação PNG", importComparison: "Importar comparação JSON",
  quantitiesCsv: "Exportar quantitativos CSV", analysisJson: "Exportar fabricação JSON", importAnalysis: "Importar fabricação JSON",
  scope: "Escopo", scopeValue: "Valor do escopo", group: "Agrupar por", column: "Colunas", sort: "Ordenar por",
  component: "Componente", components: "Componentes", occurrences: "Ocorrências", geometries: "Geometrias únicas",
  types: "Tipos autorados", blocks: "Definições de bloco", area: "Área", volume: "Volume", dimensions: "Dimensões autoradas",
  material: "Material de fabricação", category: "Categoria", layer: "Camada", coverage: "Cobertura",
  volumeCoverage: "Cobertura de volume", subtotal: "Subtotais por método",
  noData: "Sem dados no escopo", overlap: "Os grupos se sobrepõem. A soma dos subtotais pode exceder o total único.",
  configuration: "Análise de fabricação", library: "Biblioteca de materiais", scenarios: "Cenários",
  scenario: "Cenário ativo", save: "Salvar", density: "Densidade (kg/m³)", cost: "Custo por kg", currency: "Moeda",
  name: "Nome", code: "Código", notes: "Observações", provenance: "Fonte", mapping: "Mapeamento de propriedades",
  authored: "Valor por componente", machine: "Tempo de máquina (s)", production: "Estimativa de produção (s)",
  recorded: "Tempo registrado (s)", costSubtotal: "Custo de material", scenarioSubstitution: "Material substituído",
  compareQuantities: "Indicadores entre revisões", compareCoverage: "Cobertura diferente ou parcial. Os deltas descrevem subtotais conhecidos.",
  noComparison: "Carregue uma segunda revisão no workspace Comparar.",
  visual: "Layout de quantitativos", chart: "Indicador do gráfico", covered: "incluídos", excluded: "excluídos",
  quantityTable: "Tabela de quantitativos", automatic: "Dados da revisão", selectedRows: "Linhas selecionadas",
  modeSwitch: "Alternar revisão", fit: "Enquadrar comparação", noHash: "Hash indisponível neste contexto",
  reset: "Limpar", focusTable: "Foco na tabela", focusModel: "Foco no modelo", modelTable: "Modelo e tabela",
  modelAnalytics: "Modelo e análise", inspectionRecordsEmpty: "Carregue arquivos de inspeção ligados às revisões abertas.",
  bakedTransforms: "Transformações gravadas nos vértices fazem parte da forma local analisada.",
  isolatePair: "Isolar seleção comparada",
};

export const diffLabels: Record<DiffStatus, string> = {
  unchanged: "Inalterado", added: "Adicionado", removed: "Removido", modified: "Modificado", unresolved: "Não resolvido",
};
export const diffSymbols: Record<DiffStatus, string> = { unchanged: "=", added: "+", removed: "−", modified: "Δ", unresolved: "?" };
export const changeLabels: Record<Change, string> = {
  geometry: "Geometria", position: "Posição", rotation: "Rotação", scale: "Escala", material: "Material",
  layer: "Camada", category: "Categoria", metadata: "Metadados", fabrication: "Fabricação", assembly: "Montagem", replacement: "Substituição",
};
export const shapeLabels = {
  identical: "Triângulos locais idênticos", "mesh-different": "Malhas diferentes. Amostras dentro da tolerância.",
  "above-tolerance": "Malhas com diferença acima da tolerância", inconclusive: "Comparação geométrica inconclusiva",
};
export const matchLabels: Record<MatchMethod, string> = {
  persistent: "Identidade persistente", authored: "Identificação autorada", manual: "Decisão manual",
  heuristic: "Sugestão geométrica e contextual", ambiguous: "Correspondência ambígua", unmatched: "Sem correspondência",
};
export const compareModeLabels: Record<CompareMode, string> = {
  side: "Lado a lado", overlay: "Sobreposição", differences: "Só diferenças", toggle: "Alternar revisões",
};
export const scopeLabels: Record<QuantityScope, string> = {
  all: "Modelo completo", visible: "Elementos visíveis", selected: "Seleção", filtered: "Resultado dos filtros",
  modified: "Componentes modificados", category: "Categoria", material: "Material de fabricação",
};
export const groupLabels: Record<Grouping, string> = {
  category: "Categoria", layer: "Camada CAD", userLayer: "Camada do usuário", material: "Material de fabricação", block: "Definição de bloco",
  part: "Part ID", type: "Código de tipo", prototype: "Protótipo", property: "Propriedade personalizada", group: "Grupos CAD", userGroup: "Grupos do usuário",
};
export const massLabels = { solid: "Massa maciça teórica", slicer: "Massa do slicer", measured: "Massa medida", estimate: "Massa estimada" };
export const timeLabels = { machine: v07.machine, production: v07.production, recorded: v07.recorded };
export const provenanceLabels: Record<string, string> = { cad: "CAD", mesh: "Malha", authored: "Autorado", scenario: "Cenário" };
export const coverageReasons: Record<string, string> = {
  "different-method": "outro método", "missing-geometry": "geometria indisponível", "open-mesh": "malha aberta",
  "open-or-invalid-mesh": "malha aberta ou inválida", "missing": "dado ausente", "missing-density": "densidade ausente",
  "missing-volume": "volume ausente", "missing-record": "registro ausente", "invalid-result": "resultado inválido",
  "missing-cost": "custo ausente", "different-currency": "outra moeda", "missing-compatible-mass": "massa compatível ausente",
  "missing-fabrication-material": "material ausente",
};
