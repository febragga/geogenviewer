import type { MetadataRoute } from "next";
import { GEOGEN_BRAND_BLUE } from "../src/lib/geogen/version";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GeoGenViewer",
    short_name: "GeoGenViewer",
    description:
      "Visualizador web local para modelos arquitetônicos, geometria computacional, montagem e fabricação digital.",
    start_url: "/",
    display: "standalone",
    background_color: "#0C0D0E",
    theme_color: GEOGEN_BRAND_BLUE,
    lang: "pt-BR",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/brand/geogenviewer-mark.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
