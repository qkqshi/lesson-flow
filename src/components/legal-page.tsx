import Link from "next/link";
import type { ReactNode } from "react";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export function LegalPage({
  eyebrow,
  title,
  summary,
  children,
}: LegalPageProps) {
  return (
    <main className="legal-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="legal-header">
        <Link className="legal-back" href="/" aria-label="Вернуться к расписанию">
          <span aria-hidden="true">‹</span>
          Расписание
        </Link>
        <div className="legal-mark" aria-hidden="true">
          LF
        </div>
      </header>

      <section className="legal-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{summary}</p>
      </section>

      <article className="legal-card">{children}</article>

      <footer className="legal-page-footer">
        <span>Обновлено 10 сентября 2026 года</span>
        <nav aria-label="Юридическая информация">
          <Link href="/privacy">Конфиденциальность</Link>
          <Link href="/terms">Условия</Link>
        </nav>
      </footer>
    </main>
  );
}
