# GeoGenViewer

Visualizador local de modelos arquitetônicos GLB. A documentação compartilhada do projeto fica na raiz do repositório.

## Executar

Com Node.js 22.14.0 ou compatível, rode nesta pasta:

```sh
npm ci
npm run dev
```

Abra http://localhost:3000/viewer. Use **Carregar demonstração** para abrir a estrutura sintética com um cubo de 100 mm, ou **Abrir GLB** para ler um arquivo no próprio navegador. O GLB deve ser autocontido e o navegador precisa de WebGL 2.

```sh
npm run lint
npm run test
npm run build
npm run typecheck
```

Para regenerar o GLB sintético, use `npm run fixture`.
