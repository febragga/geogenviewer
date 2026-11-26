import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./analytics.css";
import "./documentation.css";
import "./home.css";
import { GEOGEN_BRAND_BLUE, GEOGEN_VERSION_LABEL } from "../src/lib/geogen/version";

export const metadata: Metadata = {
  title: {
    default: "GeoGenViewer — Da geometria à montagem",
    template: "%s · GeoGenViewer",
  },
  applicationName: "GeoGenViewer",
  description:
    `Visualizador web local (${GEOGEN_VERSION_LABEL}) de modelos arquitetônicos e geometria computacional em GLB + Manifesto CAD v1.0.0.`,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
  colorScheme: "light dark",
};

const themeInitScript = `
(function(){
  try {
    var saved = localStorage.getItem("geogen-color-scheme");
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
