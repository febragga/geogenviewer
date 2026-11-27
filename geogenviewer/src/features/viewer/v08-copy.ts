import type { CatalogGroup, CatalogScope, CatalogSort } from "../../lib/geogen/documentation/catalog";
import type { CatalogColumn, Density, SheetField, SheetFrame, SheetTemplate, ThumbnailStyle } from "../../lib/geogen/documentation/document";
import type { LayoutMode, Orientation } from "../../lib/geogen/documentation/knolling";
import type { CalloutKind, Leader } from "../../lib/geogen/documentation/callouts";

export const v08 = {
  knolling: "Knolling", catalog: "Catálogo", lab: "Laboratório de catálogo", labTitle: "Laboratório sintético de catálogo",
  layout: "Configurar disposição", mode: "Modo de disposição", plane: "Plano CAD", group: "Agrupar por", sort: "Ordenar por",
  renameSteps: "Renomear etapas ou categorias",
  scope: "Escopo de componentes", value: "Valor do filtro", orientation: "Orientação das peças",
  spacing: "Espaçamento entre peças", groupSpacing: "Espaçamento entre grupos", width: "Largura máxima", margin: "Margem externa",
  columns: "Colunas", alignment: "Alinhamento", direction: "Ordem de disposição", generate: "Gerar disposição",
  reset: "Restaurar parâmetros", fit: "Enquadrar disposição", showGroups: "Mostrar títulos de grupos", showLabels: "Mostrar callouts",
  showQuantities: "Mostrar quantidades", progress: "Transição montada → organizada", play: "Reproduzir transição",
  pause: "Pausar", resetPose: "Voltar à pose montada", components: "Componentes", specimens: "Ocorrências",
  pin: "Fixar nesta posição", unpin: "Liberar posição", pinX: "Posição no primeiro eixo", pinY: "Posição no segundo eixo",
  rotation: "Rotação manual (°)", resetOrientation: "Restaurar orientação", manualPose: "Posição e orientação da peça",
  catalogView: "Vista do catálogo", search: "Pesquisar peças", density: "Densidade", type: "Tipo",
  inconsistent: "Tipo com divergências", confirmType: "Confirmar agrupamento", splitType: "Separar variantes",
  blockType: "Usar bloco como tipo quando faltar código", manualType: "Tipo manual", viewImage: "Aparência da miniatura",
  detail: "Detalhes da peça", isolate: "Isolar e enquadrar", locate: "Localizar no modelo montado",
  otherRevision: "Ocorrência correspondente", otherRevisionImage: "Ver peça da outra revisão",
  makeSheet: "Abrir ficha técnica", noParts: "Nenhuma peça atende ao escopo.",
  noSelection: "Selecione uma peça.", typeCount: "Quantidade", unavailable: "Indisponível",
  callouts: "Callouts e lista de peças", addCallout: "Adicionar callout", calloutText: "Texto do callout", leader: "Linha de chamada",
  offsetX: "Deslocamento horizontal (px)", offsetY: "Deslocamento vertical (px)", showCallout: "Callout visível",
  removeCallout: "Remover callout", earlier: "Mover para cima", later: "Mover para baixo",
  parts: "Lista de peças", columnsConfig: "Configurar colunas", fields: "Campos da ficha", export: "Exportar e restaurar",
  exportKnoll: "Exportar PNG do knolling", exportPart: "Exportar PNG da peça", exportCallouts: "Exportar PNG com callouts",
  exportSheet: "Exportar PNG da ficha", exportCsv: "Exportar CSV do catálogo", exportCatalog: "Exportar catálogo JSON",
  exportKnolling: "Exportar knolling JSON", exportDocumentation: "Exportar documentação JSON",
  importDoc: "Importar documentação V0.8", preparing: "Gerando imagem…", invalid: "Referência indisponível",
  sheet: "Ficha técnica", manual: "Manual de montagem", print: "Imprimir ficha", preview: "Gerar ficha",
  views: "Vistas da ficha", front: "Frontal", top: "Superior", left: "Esquerda", right: "Direita", back: "Posterior",
  bottom: "Inferior", axonometric: "Axonométrica", current: "Viewport atual", page: "Formato da página",
  title: "Título", subtitle: "Subtítulo", notes: "Observações", brand: "Identificação visual", background: "Fundo da ficha",
  vertical: "Retrato", horizontal: "Paisagem", viewFrame: "Referencial da peça", globalFrame: "Eixos do projeto", localFrame: "Eixos da peça",
  step: "Etapa de montagem", stage: "Instante da etapa", stageFraction: "Progresso de inserção",
  before: "Antes da etapa", during: "Durante a inserção", after: "Após a etapa", noAssembly: "Este modelo não tem sequência autorada.",
  actual: "Revisão do catálogo", project: "Projeto", revision: "Revisão", prototype: "Protótipo",
  compare: "Estado entre revisões", property: "Propriedade personalizada", prototypeFilter: "Filtrar protótipo",
  meshBasis: "Documentação derivada da malha GLB tessellada. Unidades e proveniência indicadas por campo.",
  previewNote: "A imagem representa a ficha selecionada. A impressão usa o formato escolhido no navegador.",
  exactDoc: "Documento V0.8 restaurado.", noRenderer: "A viewport ainda está carregando.",
  titleInCapture: "Incluir identificação do projeto na imagem", leaderLines: "Incluir linhas de chamada", includeLegend: "Incluir legenda",
  transparent: "Fundo transparente", measurements: "Medições", graphicScale: "Escala gráfica ortográfica", identifiers: "Identificadores",
  axes: "Eixos", grid: "Grade", failed: "Falha ao gerar documento.", found: "Resultados", namedKnoll: "vista de knolling",
  originalNamed: "Use Explorar para aplicar uma vista da pose original.", noCounterpart: "Sem correspondência confirmada.",
  missingDocumentModel: "A configuração da vista pertence a outro GLB.", conflict: "Ajuste o layout para continuar.",
} as const;

export const catalogGroups: Record<CatalogGroup, string> = {
  category: "Categoria", layer: "Camada CAD", userLayer: "Camada do usuário", material: "Material de fabricação", group: "Grupo CAD", userGroup: "Grupo do usuário", type: "Tipo autorado",
  assembly: "Etapa de montagem", prototype: "Protótipo",
};
export const catalogScopes: Record<CatalogScope, string> = {
  all: "Modelo completo", selected: "Peças selecionadas", visible: "Elementos visíveis", filtered: "Filtros do visualizador",
  layer: "Camada CAD", userLayer: "Camada do usuário", group: "Grupo CAD", userGroup: "Grupo do usuário", category: "Categoria", material: "Material de fabricação", type: "Tipo",
  assembly: "Etapa de montagem", modified: "Peças modificadas",
};
export const catalogSort: Record<CatalogSort, string> = {
  name: "Nome", part: "Part ID", type: "Type ID", category: "Categoria", layer: "Camada CAD", userLayer: "Camada do usuário", material: "Material de fabricação",
  length: "Comprimento autorado", projected: "Área projetada", area: "Área", volume: "Volume", mass: "Massa disponível", assembly: "Etapa",
};
export const layoutModes: Record<LayoutMode, string> = {
  grid: "Grade", grouped: "Grade por grupos", shelf: "Prateleiras", types: "Representantes por tipo", assembly: "Ordem de montagem",
};
export const orientations: Record<Orientation, string> = {
  preserve: "Original", largestFace: "Maior face", principalAxis: "Eixo principal", world: "Alinhar aos eixos", quarter: "Girar 90°", longest: "Alinhar eixo mais longo", manual: "Manual",
};
export const densityLabels: Record<Density, string> = { compact: "Compacta", comfortable: "Confortável", detailed: "Detalhada" };
export const thumbnailStyles: Record<ThumbnailStyle, string> = {
  axonometric: "Axonométrica", orthographic: "Ortográfica", technical: "Técnica", mono: "Monocromática", materials: "Materiais originais",
};
export const catalogColumns: Record<CatalogColumn, string> = {
  part: "Part ID", type: "Type ID", category: "Categoria", layer: "Camada", material: "Material de fabricação",
  dimensions: "Dimensões autoradas", volume: "Volume", mass: "Massa disponível", status: "Estado na revisão",
};
export const templateLabels: Record<SheetTemplate, string> = {
  component: "Peça individual", type: "Tipo", assembly: "Etapa de montagem", knolling: "Prancha de knolling",
  inspection: "Inspeção", comparison: "Comparação de peças",
};
export const frameLabels: Record<SheetFrame, string> = {
  axonometric: v08.axonometric, front: v08.front, top: v08.top, left: v08.left, right: v08.right, back: v08.back,
  bottom: v08.bottom, current: v08.current,
};
export const sheetFields: Record<SheetField, string> = {
  identity: "Identificação", dimensions: "Dimensões e grandezas", fabrication: "Fabricação", measurements: "Medições",
  assembly: "Sequência", parts: "Lista de peças", callouts: "Legendas",
};
export const leaderLabels: Record<Leader, string> = { line: "Simples", dot: "Com ponto", arrow: "Com seta", dash: "Tracejada", none: "Sem linha" };
export const calloutKinds: Record<CalloutKind, string> = { part: "Peça", number: "Numérico", technical: "Técnico", assembly: "Montagem", custom: "Personalizado" };
