"use client";

import { useState } from "react";
import AnswerCard from "@/components/AnswerCard";
import { askQuestion, AskError, type Answer } from "@/lib/ask";
import type { DatasetContext } from "@/lib/datasetContext";

type Entry = {
  id: number;
  question: string;
  step: string;
  answer?: Answer;
  error?: string;
};

const MAX_QUESTION_CHARS = 500;

export default function AskPanel({ dataset }: { dataset: DatasetContext }) {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const busy = entries.some((e) => !e.answer && !e.error);

  const update = (id: number, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const submit = async () => {
    const q = question.trim();
    if (!q || busy) return;
    const id = Date.now();
    setEntries((prev) => [{ id, question: q, step: "Starting…" }, ...prev]);
    setQuestion("");
    try {
      const answer = await askQuestion(q, dataset, (step) => update(id, { step }));
      update(id, { answer });
    } catch (err) {
      console.error(err);
      update(id, { error: err instanceof AskError ? err.message : "Something went wrong. Try again." });
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Ask a question</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          placeholder="e.g. Which region had the highest revenue?"
          aria-label="Your question about the data"
          className="flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-indigo-500 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy ? "Working…" : "Ask"}
        </button>
      </form>

      {entries.map((e) => (
        <article key={e.id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="font-medium">{e.question}</p>
          {e.answer ? (
            <AnswerCard answer={e.answer} />
          ) : e.error ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {e.error}
            </p>
          ) : (
            <p className="animate-pulse text-sm text-zinc-500" aria-live="polite">
              {e.step}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
