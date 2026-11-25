import Link from "next/link";

export default function Home() {
  return <main className="home"><h1>GeoGenViewer</h1><p>Explore modelos arquitetônicos 3D no navegador.</p><Link href="/viewer">Abrir visualizador</Link></main>;
}
