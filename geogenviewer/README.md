# GeoGenViewer

Visualizador local de modelos arquitetônicos GLB, com inspeção de componentes, vistas ortográficas e perspectiva, apresentação, vista explodida e sequência de montagem.

## Executar

Use Node.js 22.14.0 ou compatível. Nesta pasta, rode:

```sh
npm ci
npm run dev
```

Abra [o visualizador local](http://localhost:3000/viewer). Em **Abrir modelo**, escolha um GLB autocontido e, quando disponível, o manifesto 1.0.0 correspondente. O navegador precisa de WebGL 2.

Para verificar os três workspaces, experimente o [pavilhão sintético](http://localhost:3000/viewer?demo=pavilhao). O pacote de referência para integração com exportadores está em [exporter-contract](../exporter-contract/).

## Verificar

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:ui
npm run test:v05
npm run benchmark:v05
```

Os testes de navegador usam o build de produção e salvam capturas em `test-results/`. Use `npm run fixture` para regenerar a estrutura GLB básica e `node scripts/generate-explode-demo.mjs` para regenerar o pavilhão com montagem.

- [Guia de uso da V0.5](../V05_USER_GUIDE.md)
- [Arquitetura](../ARCHITECTURE.md)
- [Relatório de implementação](../V05_IMPLEMENTATION_REPORT.md)
- [Testes e capturas](../V05_TEST_REPORT.md)
- [Desempenho](../V05_PERFORMANCE_REPORT.md)
