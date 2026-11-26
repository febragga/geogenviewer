import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./analytics.css";
import "./documentation.css";
import "./home.css";
import { GEOGEN_BRAND_BLUE, GEOGEN_VERSION_LABEL } from "../src/lib/geogen/version";

export const metadata: Metadata = {
  metadataBase: new URL("https://geogenviewer.fernandobragaportfolio.com.br"),
  title: {
    default: "GeoGenViewer — Da geometria à montagem",
    template: "%s · GeoGenViewer",
  },
  applicationName: "GeoGenViewer",
  description:
    `Visualizador web local (${GEOGEN_VERSION_LABEL}) de modelos arquitetônicos e geometria computacional em GLB + Manifesto CAD v1.0.0.`,
  openGraph: {
    type: "website",
    locale: "pt_BR",
    title: "GeoGenViewer — Da geometria à montagem",
    description:
      "Inspeção por componentes, vista explodida, montagem, comparação de revisões, knolling e catálogo no navegador, sem envio de arquivos.",
    siteName: "GeoGenViewer",
    images: [
      {
        url: "/brand/geogenviewer-og.png",
        width: 1200,
        height: 630,
        alt: "GeoGenViewer — símbolo triangular azul sobre grade arquitetônica",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E6EAF0" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0D0E" },
  ],
};

const themeInitScript = `
(function(){
  try {
    var saved = localStorage.getItem("geogen-color-scheme");
    if (saved === null) saved = JSON.parse(localStorage.getItem("geogen:v09:settings") || "{}")?.theme;
    if (saved === "light" || saved === "dark") {
      var meta = document.querySelector('meta[name="color-scheme"]');
      if (meta) meta.setAttribute("content", saved);
    }
  } catch (e) {}
})();
`.trim();

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning data-brand-color={GEOGEN_BRAND_BLUE}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
