# GeoGenViewer (`v0.7.0`)

Visualizador local de modelos arquitetônicos GLB, com inspeção de componentes, gestão de vistas, corte, medição, apresentação, vista explodida, sequência de montagem, comparação de revisões, quantitativos e análise de fabricação.

## Executar

Use Node.js 22.14.0 ou compatível. Nesta pasta, rode:

```sh
npm ci
npm run dev
```

Abra [o visualizador local](http://localhost:3000/viewer). Escolha um GLB autocontido e, quando disponível, o manifesto 1.0.0 correspondente. O navegador precisa de WebGL 2.

- **Laboratório de revisões** na tela inicial do visualizador.
- [Laboratório sintético de inspeção](http://localhost:3000/viewer?demo=inspecao)
- [Pavilhão sintético de explosão e montagem](http://localhost:3000/viewer?demo=pavilhao)
- [Pacote de referência do exportador](../exporter-contract/)
- [Schema independente do JSON de inspeção](schemas/inspection-v1.schema.json)

## Verificar

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:ui
npm run test:v05
npm run test:v06
npm run test:v07
npm run benchmark:v05
npm run benchmark:v06
npm run benchmark:v07
```

A auditoria de navegador usa o build de produção e grava capturas em `test-results/`. Use `npm run fixture:inspection` para regenerar o laboratório com o manifesto e as referências numéricas. `npm run fixture` regenera o GLB básico. `npm run fixture:revision` regenera a fixture V0.7. `npm run reports:v07` gera os exemplos CSV e JSON. Com `GEOGEN_V07_GPU=1`, a suíte V0.7 inclui testes gráficos de 100, 1.000 e 10.000 componentes por revisão.

- [Guia V0.7](../V07_USER_GUIDE.md) · [Testes](../V07_TEST_REPORT.md) · [Desempenho](../V07_PERFORMANCE_REPORT.md)
- [Guia V0.6](../V06_USER_GUIDE.md)
- [Arquitetura](../ARCHITECTURE.md)
- [Implementação](../V06_IMPLEMENTATION_REPORT.md)
- [Testes e capturas](../V06_TEST_REPORT.md)
- [Desempenho](../V06_PERFORMANCE_REPORT.md)
