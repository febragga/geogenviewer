import Link from "next/link";
import {
  BrandMarkIcon,
  CubeIcon,
  FolderOpenIcon,
} from "../src/features/viewer/components/icons";
import { ThemeToggle } from "../src/features/viewer/components/theme-toggle";
import { copy } from "../src/features/viewer/copy";

export default function Home() {
  return (
    <div className="gg-home-shell">
      <header className="gg-home-header">
        <div className="gg-brand">
          <BrandMarkIcon className="gg-brand__mark" />
          <span className="gg-brand__name">{copy.title}</span>
          <span className="gg-badge gg-badge--neutral gg-mono">v0.1</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="gg-home-main">
        <section className="gg-home-panel">
          <p className="gg-section-index gg-technical-label">
            {copy.homeEyebrow}
          </p>
          <h1 className="gg-home-title">{copy.title}</h1>
          <p className="gg-home-lead">{copy.homeTagline}</p>

          <div className="gg-home-actions">
            <Link href="/viewer" className="gg-btn gg-btn--primary">
              <FolderOpenIcon size={15} strokeWidth={1.75} />
              <span>{copy.homeOpenViewer}</span>
            </Link>
            <Link href="/viewer?demo=1" className="gg-btn gg-btn--secondary">
              <CubeIcon size={15} strokeWidth={1.75} />
              <span>{copy.homeOpenDemo}</span>
            </Link>
          </div>

          <ul className="gg-home-specs" aria-label="Especificações da versão">
            <li>{copy.homeSpecFormat}</li>
            <li>{copy.homeSpecPrivacy}</li>
            <li>{copy.homeSpecTarget}</li>
          </ul>

          <p className="gg-home-note">{copy.homeCaseNote}</p>
        </section>
      </main>
    </div>
  );
}
