import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./analytics.css";

export const metadata: Metadata = {
  title: "GeoGenViewer",
  description:
    "Visualizador web local de modelos arquitetônicos e geometria computacional em GLB.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
