import { GITHUB_URL, PORTFOLIO_URL } from "@/components/SiteNav";

export default function SiteFooter() {
  return (
    <footer className="relative z-[1] mt-16 border-t border-line">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-2 px-4 py-6 font-mono text-[0.7rem] tracking-wide text-muted sm:flex-row sm:px-8">
        <p>Built by Mo Pofahl with Claude, Next.js and DuckDB</p>
        <p className="flex gap-5">
          <a href={PORTFOLIO_URL} className="transition hover:text-ink">
            mopofahl.com
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="transition hover:text-ink">
            Source on GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
