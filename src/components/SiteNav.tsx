import Image from "next/image";
import Link from "next/link";

export const PORTFOLIO_URL = "https://mopofahl.com";
export const GITHUB_URL = "https://github.com/mowpofahl/ai-data-analyst";

// Fixed, blurred bar like the portfolio's, with a way back to it.
export default function SiteNav() {
  return (
    <nav className="fixed inset-x-0 top-0 z-50 border-b border-line bg-bg/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="AI Analyst home">
          <Image src="/signature.png" alt="" width={84} height={36} className="hidden h-9 w-auto invert sm:block" priority />
          <span className="hidden h-5 w-px bg-line-strong sm:block" aria-hidden />
          <span className="font-mono text-sm tracking-[0.1em] text-accent">AI ANALYST</span>
        </Link>
        <ul className="flex items-center gap-5 text-sm text-muted sm:gap-8">
          <li>
            <a href={GITHUB_URL} target="_blank" rel="noopener" className="transition hover:text-ink">
              GitHub
            </a>
          </li>
          <li>
            <a
              href={PORTFOLIO_URL}
              className="rounded-md border border-line-strong px-3 py-1.5 text-ink transition hover:border-muted hover:bg-card"
            >
              Portfolio ↗
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
