"use client";

import { chip } from "@/lib/ui";

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
            className={chip}
          >
            {q}
          </button>
        </li>
      ))}
    </ul>
  );
}
