"use client";

export default function QuestionChips({
  questions,
  onPick,
  disabled,
}: {
  questions: string[];
  onPick: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="flex flex-wrap gap-2">
      {questions.map((q) => (
        <li key={q}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(q)}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-left text-sm hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40"
          >
            {q}
          </button>
        </li>
      ))}
    </ul>
  );
}
