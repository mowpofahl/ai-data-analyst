export default function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
      <span aria-hidden>🔒</span>
      <span>
        <strong>Your file stays in your browser.</strong> It&apos;s loaded into a database that runs on your device. When you
        ask a question, only column names, summary stats and query results are sent to the AI, never the raw file.
      </span>
    </p>
  );
}
