import type { PlaybackStatus } from "../../lib/geogen/assembly/timeline";
import type { FilterField } from "../../lib/geogen/domain/visibility";
import type { ViewLayout, ViewPreset } from "./scene/camera-state";
import type { DisplayMode, GraphicsQuality } from "./state/presentation-store";
import type { Workspace } from "./state/viewer-store";

import { v07 } from "./v07-copy";

export const workspaces: Record<Workspace, string> = { explore: "Explorar", explode: "Explodir", assembly: "Montagem", inspect: "Inspecionar", compare: v07.compare, quantities: v07.quantities, knolling: "Knolling", catalog: "Catálogo" };
export const presets: Record<ViewPreset, string> = {
  perspective: "Perspectiva", axonometric: "Axonométrica", top: "Superior", bottom: "Inferior",
  front: "Frontal", back: "Posterior", left: "Esquerda", right: "Direita",
};
export const layouts: Record<ViewLayout, string> = {
  single: "Única", horizontal: "Duas lado a lado", vertical: "Duas empilhadas", quad: "Quatro vistas",
};
export const displayModes: Record<DisplayMode, string> = {
  shaded: "Sombreado", material: "Materiais GLB", mono: "Mono", technical: "Técnico",
  blueprint: "Blueprint", dither: "Dither", clayStudio: "Clay",
  wireframe: "Aramado", xray: "Raio X", layer: "Cor por camada", category: "Cor por categoria", semanticMaterial: "Cor por material",
};
export const qualities: Record<GraphicsQuality, string> = {
  performance: "Desempenho", balanced: "Equilibrada", high: "Alta",
};
export const filterFields: Record<FilterField, string> = {
  layer: "Camadas CAD", group: "Grupos CAD", userLayer: "Camadas do usuário", userGroup: "Grupos do usuário",
  category: "Categorias", material: "Materiais",
  geometry: "Tipos geométricos", block: "Definições de bloco", instance: "Instâncias",
  selection: "Seleção", assembly: "Estado de montagem",
};
export const playbackLabels: Record<PlaybackStatus, string> = {
  idle: "Sem sequência", ready: "Pronta", playing: "Em reprodução", paused: "Pausada", completed: "Concluída",
};
export const assemblyStates = {
  context: "Contexto", future: "Futuro", active: "Etapa atual", mounted: "Montado",
};

export const v05 = {
  workspace: "Workspace", views: "Vistas", projection: "Projeção", orientation: "Orientação",
  homeView: "Vista inicial",
  rotate90Ccw: "Girar 90° anti-horário",
  rotate90Cw: "Girar 90° horário",
  perspShort: "Persp.",
  orthoShort: "Orto.",
  toggleProjection: "Alternar projeção perspectiva/ortográfica",
  navCubeLabel: "Cubo de navegação 3D",
  perspective: "Perspectiva", orthographic: "Ortográfica", layout: "Distribuição", named: "Vistas salvas",
  syncTarget: "Sincronizar alvo", syncZoom: "Sincronizar zoom ortográfico", maximize: "Maximizar vista",
  restoreLayout: "Restaurar layout", display: "Exibição", filters: "Filtros", settings: "Apresentação",
  fitSelection: "Enquadrar seleção", fitExtents: "Enquadrar extensão", hideUnselected: "Ocultar não selecionados",
  undoIsolate: "Desfazer isolamento", invert: "Inverter visibilidade", selectVisible: "Selecionar visíveis",
  selectionShared: "Seleção compartilhada", visibilityShared: "Visibilidade compartilhada",
  exposure: "Exposição",
  clean: "Modo limpo", fullscreen: "Tela cheia", exportPng: "Exportar PNG", transparent: "Fundo transparente",
  resolution: "Largura do PNG", quality: "Qualidade gráfica", diagnostics: "Diagnóstico",
  background: "Fundo", grid: "Grade", axes: "Eixos mundiais", ground: "Plano de chão",
  shadows: "Sombras", edges: "Arestas", light: "Iluminação", opacity: "Opacidade",
  save: "Salvar", apply: "Aplicar", update: "Atualizar", rename: "Renomear", duplicate: "Duplicar", remove: "Excluir",
  name: "Nome", localFailure: "O navegador bloqueou o armazenamento local. A configuração fica disponível nesta sessão.",
  filterHelp: "Opções do mesmo filtro se somam. Filtros diferentes precisam coincidir.",
  searchFilters: "Pesquisar opções", moreOptions: "Mostrar mais opções",
  emptyFilter: "Nenhuma opção disponível.", savePreset: "Salvar combinação", preset: "Combinações salvas",
  sequence: "Sequência de montagem", editor: "Editar sequência", editTitle: "Editor de montagem",
  ghost: "Peças futuras em transparência", noAssembly: "Crie a primeira etapa para reproduzir a montagem.",
  noManifest: "Abra um pacote GLB + manifesto para editar uma sequência.",
  play: "Reproduzir", pause: "Pausar", stop: "Parar", restart: "Reiniciar",
  prev: "Etapa anterior", next: "Próxima etapa", speed: "Velocidade", loop: "Repetir",
  title: "Título da etapa", duration: "Duração em segundos", insert: "Deslocamento de inserção em metros (Y para cima)",
  depends: "Depende de", noDependencies: "Nenhuma etapa anterior.", pieces: "Componentes",
  addSelection: "Adicionar seleção", addStep: "Criar etapa", moveUp: "Mover para cima", moveDown: "Mover para baixo",
  preview: "Mostrar só esta etapa", endPreview: "Sair da prévia", importSequence: "Usar sequência importada",
  downloadManifest: "Baixar manifesto JSON", savedSequence: "Sequência aplicada ao visualizador.",
  offsetHint: "Prévia de deslocamento de montagem. A trajetória física exige validação independente.",
};
