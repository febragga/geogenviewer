# GeoGenViewer V0.5 — guia de utilização

Abra `/viewer` em um navegador com WebGL 2. Em **Abrir modelo**, selecione um GLB autocontido ou selecione junto o `manifest.json` correspondente. Um `export_report.json` selecionado junto é ignorado pelo visualizador. Em caso de inconsistência, a interface informa a falha e oferece explicitamente a abertura do GLB sozinho.

O menu de ações traz o **Pavilhão Estrutural Sintético**. Ele tem 18 componentes, incluindo fundação, pilares, vigas, lajes, escada, conectores, blocos repetidos e seis etapas de montagem.

## Explorar

- Arraste a viewport para orbitar. Use a roda para aproximar e afastar. Em toque, use um dedo para orbitar, dois dedos para deslocar e pinça para zoom. Toque ou clique em uma peça para selecioná-la.
- Use **Estrutura** para pesquisar por nome, ID, camada, grupo, categoria, material e propriedades personalizadas. Use **Propriedades** para consultar dados de origem, caixa envolvente de malha e informações de fabricação disponíveis.
- Use **Vistas** para trocar orientação e projeção, escolher o layout e salvar uma vista. Clique em uma região para ativá-la. Clique duas vezes no seu botão para maximizar, ou use **Maximizar vista** no menu. Em layouts múltiplos, configure compartilhamento de seleção, visibilidade, alvo e zoom ortográfico.
- Use **Filtros** para combinar valores. Dois valores na mesma faceta funcionam como uma união. Valores de facetas diferentes precisam coincidir. As ações de ocultação e isolamento reduzem o conjunto visível. **Desfazer isolamento** restaura os filtros e a visibilidade anteriores. Combinações salvas ficam no navegador.
- Use **Exibição** para estilos, fundo, grade, eixos, chão, sombras, luz, arestas, transparência, qualidade e diagnóstico. Exporte um PNG da região ativa em 1280, 1920 ou 3840 pixels de largura. O fundo transparente é opcional e a interface fica fora da imagem.

## Explodir

Selecione **Explodir** no seletor de workspace ou use o botão da viewport. Ajuste o fator, o modo, os eixos, o escopo e a granularidade no painel. **Restaurar (0%)** retorna ao repouso. Vistas, seleção e filtros continuam disponíveis.

## Montagem

Selecione **Montagem**. A timeline permite reproduzir, pausar, parar, reiniciar, avançar e retroceder por etapa ou arrastar o marcador de tempo. Velocidade e repetição ficam abaixo da timeline. Peças futuras podem aparecer em transparência. Peças fora da sequência permanecem disponíveis como contexto.

Em **Editar sequência**, crie ou selecione uma etapa. Use a seleção feita no modelo ou escolha componentes no editor. Configure título, dependências anteriores, duração e deslocamento assinado em metros nos eixos Y-up. Ao reordenar, corrija dependências que passarem a apontar para frente. **Aplicar** revalida e guarda o rascunho no navegador. **Mostrar só esta etapa** aplica e abre a prévia. **Usar sequência importada** recupera o ponto de partida do editor. **Baixar manifesto JSON** gera um documento compatível com o GLB original.

## Atalhos

| Tecla | Ação |
|---|---|
| `Ctrl+K` ou `⌘K` | Paleta de comandos |
| `F` | Enquadrar seleção ou extensão |
| `R` | Restaurar câmera da vista ativa |
| `V` | Alternar vista única e quádrupla |
| `J` | Alternar modo limpo |
| `E` | Abrir ou fechar o painel Explodir |
| `H`, `I`, `A` | Ocultar seleção, isolar seleção e mostrar tudo |
| `[`, `]` | Alternar Estrutura e Propriedades |
| `Esc` | Fechar o modo limpo ou limpar a seleção |
