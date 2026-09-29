export default function PrivacyNote() {
  return (
    <aside aria-label="Privacy" className="flex items-start gap-4 rounded-xl border border-line border-l-2 border-l-accent bg-card px-5 py-4 text-sm">
      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      </svg>
      <p className="leading-relaxed text-muted">
        <strong className="font-semibold text-ink">Your file stays in your browser.</strong> It&apos;s loaded into a database that runs
        on your device. When you ask a question, only column names, summary stats and query results are sent to the AI, never the raw
        file. Your question history is saved in this browser only.
      </p>
    </aside>
  );
}
