# GeoGenViewer — contrato de dados

**Versão proposta:** 1.0.0 · 25/11/2026  
**Status:** especificação inicial; schema executável e exportador ainda não implementados.

## 1. Objetivo e transporte

Usar GLB (glTF 2.0) para malhas, materiais e transforms de repouso; JSON UTF-8 para informações semânticas e ações de apresentação. O GLB é uma representação tessellada, não o sólido NURBS original. No MVP o usuário seleciona os dois arquivos localmente; GLB sem JSON é aceito em modo básico, com propriedades e montagem avançada desabilitadas. Não adivinhar dados ausentes.

```text
proto-01/
├── model.glb
└── manifest.json
```

Um pacote `.geogen` (ZIP) pode ser definido depois, sem alterar o conteúdo semântico. Se adotado, validar paths, limites após descompressão e integridade; não implementar no MVP. JSON não deve conter vértices duplicados, scripts executáveis ou HTML.

## 2. Convenções geométricas

| Campo | Convenção v1 |
|---|---|
| Espaço GLB e metadados espaciais | Sistema de mão direita, Y para cima, metros |
| Origem | Origem local próxima do modelo, declarada no manifesto |
| Rhino | Z para cima; unidade original explícita |
| Conversão | Para ponto Rhino `(x,y,z)`, aplicar `(x,z,-y) * fatorParaMetros` após subtrair origem Rhino |
| Direções | Converter eixos sem translação; deslocamentos também recebem fator de escala |
| Quaternions | `[x,y,z,w]`, normalizado, quando necessários em extensão futura |
| Medidas CAD | Valores em metros/m²/m³, convertidos na apresentação; fonte obrigatória |
| Escala de maquete | `scaleDenominator` informa 1:N, não redimensiona automaticamente a cena |

O GLB v1 sempre armazena a geometria no tamanho em que foi modelada (maquete ou edificação). Uma maquete 1:50 com peça de 100 mm resulta em 0,1 m na cena; dimensão real equivalente 5 m só pode ser derivada quando o usuário solicitar e a escala for conhecida. Se o GLB já foi convertido pelo exportador nativo, não converter outra vez. Testar eixos assimétricos, blocos rotacionados e escala. Transform de repouso é obtido do GLB, não duplicado no manifesto.

## 3. Exemplo de manifesto v1

Exemplo sintético; medidas, IDs e sequência abaixo não correspondem à Casa Gerassi real. Os nós GLB correspondentes devem possuir `extras.geogenElementId` com os respectivos IDs; nomes do nó são apenas rótulos.

```json
{
  "schemaVersion": "1.0.0",
  "project": {
    "id": "demo-estrutura",
    "title": "Estrutura demonstrativa",
    "revisionId": "proto-01",
    "description": "Fixture sintética de montagem",
    "geometryKind": "physicalModel",
    "scaleDenominator": 50,
    "displayUnit": "mm"
  },
  "source": {
    "application": "Rhino",
    "applicationVersion": "8",
    "sourceUnit": "mm",
    "sourceUpAxis": "Z",
    "sourceOrigin": [0, 0, 0],
    "metersPerSourceUnit": 0.001
  },
  "geometry": {
    "file": "model.glb",
    "format": "glb",
    "coordinateSystem": "RH_Y_UP",
    "unit": "m"
  },
  "layers": [
    {"id": "l-pilares", "name": "Pilares", "parentId": null},
    {"id": "l-vigas", "name": "Vigas", "parentId": null}
  ],
  "groups": [
    {"id": "g-estrutura", "name": "Estrutura", "parentId": null}
  ],
  "materials": [
    {"id": "mat-pla", "name": "PLA", "densityKgM3": null}
  ],
  "elements": [
    {
      "id": "demo-p01",
      "name": "Pilar P01",
      "category": "column",
      "layerId": "l-pilares",
      "groupIds": ["g-estrutura"],
      "materialId": "mat-pla",
      "sourceObjectId": null,
      "dimensions": {"lengthM": 0.1, "widthM": 0.01, "thicknessM": 0.01, "source": "authored"},
      "volumeM3": null,
      "explodeOffsetM": [0, -0.025, 0],
      "properties": {"connectionType": "slide", "note": "Exemplo não validado"}
    },
    {
      "id": "demo-v01",
      "name": "Viga V01",
      "category": "beam",
      "layerId": "l-vigas",
      "groupIds": ["g-estrutura"],
      "materialId": "mat-pla",
      "sourceObjectId": null,
      "dimensions": {"lengthM": 0.2, "widthM": 0.015, "thicknessM": 0.02, "source": "authored"},
      "volumeM3": null,
      "explodeOffsetM": [0, 0.05, 0],
      "properties": {}
    }
  ],
  "assembly": {
    "steps": [
      {"id": "s1", "title": "Instalar pilar", "elementIds": ["demo-p01"], "dependsOn": [], "durationSeconds": 1, "insertionOffsetM": [0, 0.03, 0]},
      {"id": "s2", "title": "Instalar viga", "elementIds": ["demo-v01"], "dependsOn": ["s1"], "durationSeconds": 1, "insertionOffsetM": [0, 0.05, 0]}
    ]
  }
}
```

## 4. Tipos, obrigatoriedade e identidade

| Campo | Tipo / regra |
|---|---|
| `schemaVersion` | string SemVer; versão major desconhecida rejeitada; minor não suportada não interpretada silenciosamente |
| `project` | objeto obrigatório: `id`, `title`, `revisionId`, `geometryKind` (`physicalModel`, `fullScale`, `unknown`), `scaleDenominator` número positivo ou null, `displayUnit` (`mm`, `cm`, `m`); `description` opcional |
| `source` | objeto obrigatório: `application`, `sourceUnit`, `sourceUpAxis`, `sourceOrigin`, `metersPerSourceUnit`; `applicationVersion` opcional; se origem desconhecida, usar valores nulos explicitamente e não permitir conversão inversa |
| `geometry` | obrigatório; `file` nome base `.glb` sem caminho, `format`, `coordinateSystem`, `unit` constantes; `sha256` opcional (64 caracteres hexadecimais) |
| `layers`, `groups`, `materials`, `elements` | arrays obrigatórios, vazios permitidos exceto `elements` para manifesto com geometria selecionável |
| `layer/group` | `id`, `name`, `parentId` (null ou ID da mesma coleção), obrigatórios |
| `material` | `id`, `name` obrigatórios; `densityKgM3` opcional, número positivo ou null; `costPerKg` opcional, objeto `{amount,currency}` com ISO 4217 |
| `element` | `id`, `name`, `category`, `layerId` (ou null), `groupIds`, `materialId` (ou null), obrigatórios; `sourceObjectId` opcional/null |
| `category` | `column`, `beam`, `slab`, `stair`, `foundation`, `connector`, `wall`, `roof`, `other`; enum inicial extensível por revisão |
| `dimensions` | opcional/null; `lengthM`, `widthM`, `thicknessM` números não negativos ou null; `source` (`cad`, `mesh`, `authored`) obrigatório quando presente |
| `volumeM3` | opcional/null, objeto `{value, source}` com valor não negativo e fonte `cad`, `mesh` ou `authored`; não estimar volume de superfície aberta |
| `explodeOffsetM` | opcional/null; vetor xyz no espaço mundial de repouso |
| `properties` | opcional; mapa de string para string/número/boolean/null, sem HTML |
| `assembly` | opcional/null; objeto com `steps` ordenados |
| `step` | `id`, `title`, `elementIds`, `dependsOn` obrigatórios; `durationSeconds` positivo opcional (default 1); `insertionOffsetM` vetor opcional (default zero) |

IDs são strings não vazias (até 128 caracteres), únicas por coleção; nomes não são chaves. `sourceObjectId` é o GUID de origem quando disponível; ocorrências de blocos devem ter IDs distintos formados por GUID/caminho de instância estável (registrar algoritmo no exportador). Versões posteriores devem reutilizar IDs de peças preservadas; peças substituídas sem vínculo explícito não são tratadas como iguais. Não usar índices de nós como IDs persistentes quando manifesto existe.

## 5. Correspondência com GLB

- Cada elemento corresponde a um nó-raiz selecionável do GLB com `extras.geogenElementId` igual ao `element.id`; suas primitivas e descendentes sem ID pertencem a ele. Um elemento pode conter múltiplas malhas nesse subtree.
- Cada ID ocorre em exatamente um nó-raiz por cena ativa; proibir raízes de elemento aninhadas no MVP. Nós estruturais sem ID são permitidos fora das raízes, mas toda geometria selecionável deve estar sob uma raiz.
- glTF `extras` do nó deve ser preservado e lido pelo importador (verificar mapeamento `userData` do loader com fixture). Não depender da ordem dos nós quando há manifesto.
- Preservar transform original do pai; para deslocar em coordenadas mundiais, converter para espaço local do pai com inversa apropriada. Instâncias com geometria compartilhada continuam com IDs individuais. Otimização não pode romper esta regra.
- Com hash presente, comparar SHA-256 dos bytes antes de carregar. Sem hash, verificar todos os IDs e reportar que a integridade binária não foi verificada.

## 6. Semântica de apresentação

Vista explodida: `positionWorld(t) = restPositionWorld + t * explodeOffsetM` para `t ∈ [0,1]`. Rotação e escala permanecem de repouso. Se vetor não existe, fallback radial determinístico identificado como visual; aplicar sem deriva. Modo montagem e modo explode são mutuamente exclusivos no MVP.

Timeline: passos são ordenados pelo array e `dependsOn` deve referir somente passos anteriores; cada elemento aparece no máximo uma vez no conjunto de passos. Elementos não listados permanecem visíveis como contexto. Antes do passo, seus elementos ficam ocultos; no passo, animam de `rest + insertionOffsetM` para `rest`, depois permanecem montados. Scrub usa tempo acumulado por duração e não depende do frame anterior. Não interpretar deslocamento como trajetória verificada de montagem.

Medições devem mostrar se a fonte é CAD, malha ou valor informado. Quantitativo soma por ocorrência, não por geometria compartilhada. Densidade do PLA nominal não garante massa impressa: considerar infill, paredes e dados do slicer quando disponíveis. Ausência de material, densidade ou volume não equivale a zero.

## 7. Validação, limites e evolução

Implementar `schemas/manifest-v1.schema.json` e tipos equivalentes; validar estrutura em JSON Schema 2020-12 e relações em código. Testes mínimos: exemplo válido, ID duplicado, layer inexistente, ciclo, versão desconhecida, vetor inválido, valor negativo, dependência futura, nome de arquivo malicioso, ID ausente/duplicado no GLB e mismatch de hash. Rejeitar recursos externos do GLB no modo local, extensões obrigatórias incompatíveis e payloads acima dos limites definidos em `ARCHITECTURE.md`.

Não permitir NaN/infinito, nem metadados executáveis. Limitar profundidade, total de elementos/nós e tamanho de strings com valores ajustados por profiling. Mensagens de erro devem indicar caminho do campo e ação corretiva. Não permitir fallback silencioso para GLB básico se manifesto foi fornecido mas inválido; oferecer escolha explícita ao usuário.

Mudanças incompatíveis exigem nova major e migração explícita; não alterar documentos sem atualizar testes. Recursos futuros como conexões físicas, callouts, fabricação, materiais compostos e comparação de versões merecem extensões definidas, não propriedades soltas interpretadas implicitamente.

Referência de formato: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
