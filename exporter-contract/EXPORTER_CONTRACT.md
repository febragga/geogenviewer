# GeoGenExporter — Contrato de Interoperabilidade (Rhino 8 ↔ GeoGenViewer)

**Versão do Contrato:** `1.0.0` · **Data:** 25/11/2026  
**Destinatário:** desenvolvimento externo do `GeoGenExporter` em Python 3 / RhinoCommon (Rhino 8).  
**Consumidor web:** importador GLB + `manifest.json` do GeoGenViewer.

---

## 1. Visão geral e arquivos de saída

Para cada modelo ou revisão exportada, o `GeoGenExporter` deve gerar **dois arquivos** no mesmo diretório (sem alterar o documento `.3dm` aberto):

1. `model.glb` — glTF 2.0 binário **autocontido** (sem URIs externas para buffers ou imagens; sem compressão Draco/Meshopt/Basis nesta versão).
2. `manifest.json` — JSON UTF-8 em conformidade estrita com `manifest.schema.json` (JSON Schema 2020-12).

> **Futuro pacote `.geogen`:** poderá empacotar `model.glb` + `manifest.json` em ZIP sem alterar o schema semântico. Não gerar `.geogen` nesta versão.

---

## 2. Unidades e sistema de coordenadas (regra anti-dupla-conversão)

| Conceito | Origem (Rhino 8) | Saída (`model.glb` + `manifest.json`) |
|---|---|---|
| Unidade geométrica da malha GLB | `doc.ModelUnitSystem` (`mm`, `cm`, `m`, `in`, `ft`) | **Sempre metros (`m`)** (`geometry.unit = "m"`) |
| Eixos | Sistema de mão direita, **Z para cima** | Sistema de mão direita, **Y para cima** (`geometry.coordinateSystem = "RH_Y_UP"`) |
| Origem do modelo | Coordenadas absolutas do documento Rhino | Subtrair `source.sourceOrigin = [ox, oy, oz]` (em unidades do Rhino) **antes** de converter para metros |

### Fórmula exata de conversão

Para qualquer ponto `(x, y, z)` no espaço do Rhino e `s = metersPerSourceUnit` (ex.: `0.001` para milímetros):

$$
(X_{\text{glTF}}, Y_{\text{glTF}}, Z_{\text{glTF}}) = \big((x - o_x) \cdot s,\ (z - o_z) \cdot s,\ -(y - o_y) \cdot s\big)
$$

Para vetores de direção/deslocamento `(dx, dy, dz)` (normais, `explodeOffsetM`, `assemblyDirectionM`, `insertionOffsetM`): **não subtrair `sourceOrigin`**. Aplicar apenas a rotação de eixos `(dx, dz, -dy)` e multiplicar por `s` quando forem deslocamentos métricos (ou normalizar quando forem vetores direcionais unitários).

### Coordenadas muito afastadas da origem

Se o modelo Rhino estiver em coordenadas geográficas/urbanas distantes (ex.: `X > 10.000 m`), o exportador **deve** calcular um `sourceOrigin` local (ex.: centro da base da bounding box do projeto) e subtraí-lo antes de gravar vértices e matrizes em `float32` no GLB. O GeoGenViewer **não** aplica conversão Z-up novamente ao carregar `model.glb` (`coordinateSystem === "RH_Y_UP"`).

---

## 3. Identidade geométrica e vinculação GLB ↔ Manifesto

**Regra crítica:** nunca utilizar o índice do nó no array `nodes` do GLB como identificador persistente.

### Estratégia primária recomendada (`nodeMatchStrategy = "extras"`)

Cada componente lógico corresponde a **exatamente um nó-raiz** selecionável na cena GLB contendo:

```json
"extras": {
  "geogenElementId": "<element.id>"
}
```

- **Objetos compostos (múltiplos meshes por componente):** criar um nó-raiz pai com `extras.geogenElementId` e pendurar os meshes/primitivas em nós filhos **sem** `geogenElementId` (ou em múltiplas primitivas do mesmo mesh). O visualizador proíbe raízes de elemento aninhadas (`element` dentro de `element` no GLB).
- **Blocos e instâncias (`InstanceObject`):** cada ocorrência visível deve gerar um nó próprio no GLB com transformação da instância, **compartilhando o índice de `mesh`** da definição do bloco quando aplicável, porém recebendo um `geogenElementId` único e determinístico:
  - Objeto simples: `<rhinoGuid>` (ou ID autorado estável).
  - Instância de bloco: `<topInstanceGuid>/<nestedPathIndices>` (ou hash determinístico do caminho de instância, ex.: `inst-<guid>-0-1`), mantendo `sourceObjectId` com o GUID da instância de topo e `blockDefinitionId` apontando para `blocks[].id`.

### Estratégia alternativa se o writer nativo do Rhino descartar `extras`

A API nativa de exportação glTF do Rhino (`FileGltf` / `doc.Export`) pode não preservar chaves personalizadas em `node.extras` em todas as builds. Portanto:

1. **Caminho preferencial:** tesselar no RhinoCommon (`Mesh.CreateFromBrep`, `ObjRef`, etc.) e serializar o GLB 2.0 diretamente em Python (`struct` + `json`), garantindo 100% de controle sobre `nodes[].extras.geogenElementId`.
2. **Caminho fallback documentado:** caso utilize um exportador intermediário que remova `extras`, gravar `geometry.nodeMatchStrategy: "nameExact"` (ou `"namePrefix"`) no manifesto e nomear cada nó-raiz no GLB de forma única (preenchendo `element.glbNodeName` no manifesto; ex.: `"GG_<element.id>__<nome>"`). O GeoGenViewer rejeitará correspondências ambíguas ou duplicadas.

---

## 4. Hierarquia: Layers, Sublayers e Múltiplos Grupos

- **Layers e Sublayers (`layers[]`):** preservados como árvore via `parentId` (`null` para raiz) e `fullPath` (ex.: `"Estrutura::Pilares"`). Todo elemento referencia exatamente um `layerId` (ou `null`).
- **Grupos do Rhino (`groups[]`):** no Rhino, um mesmo objeto pode pertencer simultaneamente a vários grupos sobrepostos. Por isso, `groups` **não** é forçado na árvore física do GLB; cada elemento declara `groupIds: string[]` (array de 0..N IDs de grupos), permitindo seleção e visibilidade por grupo no visualizador.
- **Relação lógica pai-filho opcional:** `element.parentId` pode descrever vínculo lógico entre elementos (sem exigir aninhamento de raízes `geogenElementId` no GLB).

---

## 5. Metadados CAD, proveniência e valores nulos

Nunca inventar dados ou preencher propriedades desconhecidas com `0` ou strings vazias. Use `null` quando a medida não existir no CAD.

- Toda medida derivada do RhinoCommon (`Brep.GetVolume()`, `AreaMassProperties`, `BoundingBox`) deve carregar `"source": "cad"`.
- Valores informados manualmente pelo projetista/Grasshopper usam `"source": "authored"`.
- Aproximações calculadas sobre malha usam `"source": "mesh"`.
- **Nunca estimar `volumeM3` de superfícies abertas (`isClosed === false`):** gravar `volumeM3: null`.
- **`boundingBoxM`** (eixos alinhados no espaço GLB Y-up em metros) é distinta de **`dimensions`** (`lengthM`, `widthM`, `thicknessM` locais/orientadas da peça).
- **`userText` / `properties`:** strings simples em UTF-8; **proibido** inserir HTML, `<script>` ou URLs `javascript:`.
- **Integridade:** se `geometry.sha256` estiver presente (64 hex chars minúsculos), o visualizador verificará o hash exato dos bytes de `model.glb` antes de abrir.

---

## 6. Campos reservados para montagem futura (v0.4+)

O exportador pode preencher opcionalmente `explodeOffsetM`, `assemblyDirectionM`, `connectorIds`, `fabrication` (`prototypeId`, `scaleDenominator`, `material`, `toleranceMm`) e `assembly.steps[]`. O visualizador da v0.3 valida esses campos contra o schema sem executar animações prematuramente.

---

## 7. Checklist rápido antes de entregar arquivos do GeoGenExporter

1. Validar `manifest.json` contra `manifest.schema.json` (JSON Schema 2020-12).
2. Confirmar que `geometry.file` é apenas o nome-base `.glb` (sem `C:\` ou `/`).
3. Confirmar que `model.glb` possui `asset.version === "2.0"`, sem buffers/imagens externos e sem extensões de compressão não listadas.
4. Verificar um cubo de teste de `100 mm` no Rhino: após exportação, sua bounding box no GLB deve medir `0.100 × 0.100 × 0.100 m` e `Y` deve apontar para cima.
5. Conferir o pacote executável de referência em `exporter-contract/manifest.example.json` + `exporter-contract/model.example.glb`.
