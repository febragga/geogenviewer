# GeoGenViewer V0.9 — Diretrizes de Marca

**Versão:** v0.9.0 · **Identidade:** `GEOGEN_BRAND_BLUE = #3B82F6`

---

## 1. Símbolo Oficial

O símbolo do **GeoGenViewer** representa precisão geométrica, estabilidade estrutural e progressão modular da peça à montagem:

- **Forma:** Triângulo equilátero sólido apontando para cima.
- **Cor oficial:** Azul `#3B82F6` (`GEOGEN_BRAND_BLUE` em `src/lib/geogen/version.ts`).
- **Geometria de referência (`viewBox 0 0 64 64`):** vértices `(32, 9)`, `(57.4, 53)`, `(6.6, 53)`.
- **Área de respiro:** manter margem mínima equivalente a ~14% da largura do ícone (garantida no `app/icon.svg`, `favicon.ico` e ícones PWA).

---

## 2. Ativos Gerados e Centralização

Todos os ativos são gerados de forma reproduzível por `geogenviewer/scripts/generate-brand-assets.mjs` a partir de um mesmo polígono:

| Arquivo | Uso | Dimensões |
|---|---|---|
| `geogenviewer/app/icon.svg` | Favicon vetorial padrão no `<head>` | Vetorial (`64×64`) |
| `geogenviewer/app/favicon.ico` | Compatibilidade multi-resolução ICO | 16, 32, 48 px |
| `geogenviewer/app/apple-icon.png` | Atalho iOS / iPadOS | `180×180` |
| `geogenviewer/public/icons/icon-192.png` | Web App Manifest (PWA) | `192×192` |
| `geogenviewer/public/icons/icon-512.png` | Web App Manifest (PWA splash) | `512×512` |
| `geogenviewer/public/brand/geogenviewer-mark.svg` | Marca SVG reutilizável | Vetorial |
| `geogenviewer/public/brand/geogenviewer-og.png` | Open Graph / compartilhamento social | `1200×630` |

Metadados e strings de versão (`GEOGEN_VERSION = "0.9.0"`, `GEOGEN_VERSION_LABEL = "v0.9.0"`, `GEOGEN_CONTRACT_VERSION = "1.0.0"`) residem exclusivamente em `src/lib/geogen/version.ts` e são reutilizados na Home, Topbar, Settings (`Sobre`) e `app/manifest.ts`.

---

## 3. Regras de Uso

1. Não adicionar sombras pesadas, gradientes neon ou contornos duplos ao símbolo triangular fora do preview contextual.
2. Preservar o contraste sobre fundos escuros (`#0c0d0e`) e claros (`#f8f9fb`).
3. Não misturar marcadores de sprints antigas (`v0.4`, `v0.8`) na interface do produto; usar sempre `GEOGEN_VERSION_LABEL`.
