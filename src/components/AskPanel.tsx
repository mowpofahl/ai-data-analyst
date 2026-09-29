"use client";

import { useEffect, useState } from "react";
import AnswerCard from "@/components/AnswerCard";
import QuestionChips from "@/components/QuestionChips";
import { answerClarification, askQuestion, AskError, type Answer, type AskOutcome, type Clarification } from "@/lib/ask";
import type { DatasetContext } from "@/lib/datasetContext";
import { fetchSuggestions } from "@/lib/suggest";

type Entry = {
  id: number;
  question: string;
  status: "working" | "clarify" | "done" | "error";
  step: string;
  clarification?: Clarification; // waiting on the user's reply
  replies: { question: string; reply: string }[];
  answer?: Answer;
  error?: string;
};

const MAX_QUESTION_CHARS = 500;
const MAX_REPLY_CHARS = 200;

const inputClass =
  "flex-1 rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:border-indigo-500 dark:border-zinc-700";
const primaryButton =
  "rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50";

function ClarifyPrompt({ clarification, disabled, onReply }: { clarification: Clarification; disabled: boolean; onReply: (reply: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
      <p className="text-sm">
        <span className="font-medium">Quick question before I answer:</span> {clarification.question}
      </p>
      {clarification.options.length > 0 && <QuestionChips questions={clarification.options} onPick={onReply} disabled={disabled} />}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) onReply(text.trim());
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_REPLY_CHARS}
          placeholder={clarification.options.length ? "Or type your own answer" : "Type your answer"}
          aria-label="Your answer to the clarifying question"
          className={`${inputClass} text-sm`}
        />
        <button type="submit" disabled={disabled || !text.trim()} className={`${primaryButton} text-sm`}>
          Reply
        </button>
      </form>
    </div>
  );
}

export default function AskPanel({ dataset }: { dataset: DatasetContext }) {
  const [question, setQuestion] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [suggestions, setSuggestions] = useState<string[] | null>(null); // null while loading
  const busy = entries.some((e) => e.status === "working");

  // Starter questions, written by the AI from the column summary.
  useEffect(() => {
    const controller = new AbortController();
    fetchSuggestions(dataset, controller.signal)
      .then(setSuggestions)
      .catch(() => !controller.signal.aborted && setSuggestions([]));
    return () => controller.abort();
  }, [dataset]);

  const update = (id: number, patch: Partial<Entry>) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const settle = async (id: number, run: () => Promise<AskOutcome>) => {
    try {
      const outcome = await run();
      if (outcome.kind === "answer") update(id, { status: "done", answer: outcome.answer, clarification: undefined });
      else update(id, { status: "clarify", clarification: outcome.clarification });
    } catch (err) {
      console.error(err);
      update(id, { status: "error", error: err instanceof AskError ? err.message : "Something went wrong. Try again." });
    }
  };

  const ask = (text: string, from: "typed" | "chip") => {
    const q = text.trim();
    if (!q || busy) return;
    const id = Date.now();
    setEntries((prev) => [{ id, question: q, status: "working", step: "Starting…", replies: [] }, ...prev]);
    if (from === "typed") setQuestion("");
    else requestAnimationFrame(() => document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    settle(id, () => askQuestion(q, dataset, (step) => update(id, { step })));
  };

  const reply = (entry: Entry, text: string) => {
    const clarification = entry.clarification;
    if (!clarification || busy) return;
    update(entry.id, {
      status: "working",
      step: "Using your answer…",
      clarification: undefined,
      replies: [...entry.replies, { question: clarification.question, reply: text }],
    });
    settle(entry.id, () => answerClarification(clarification, text, dataset, (step) => update(entry.id, { step })));
  };

  const asked = new Set(entries.map((e) => e.question));
  const remaining = suggestions?.filter((q) => !asked.has(q)) ?? [];

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Ask a question</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question, "typed");
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={MAX_QUESTION_CHARS}
          placeholder="e.g. Which region had the highest revenue?"
          aria-label="Your question about the data"
          className={inputClass}
        />
        <button type="submit" disabled={busy || !question.trim()} className={primaryButton}>
          {busy ? "Working…" : "Ask"}
        </button>
      </form>

      {suggestions === null ? (
        <p className="animate-pulse text-sm text-zinc-500">Coming up with questions to try…</p>
      ) : (
        remaining.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-zinc-500">Try one of these:</p>
            <QuestionChips questions={remaining} onPick={(q) => ask(q, "chip")} disabled={busy} />
          </div>
        )
      )}

      {entries.map((e) => (
        <article key={e.id} id={`question-${e.id}`} className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex flex-col gap-1">
            <p className="font-medium">{e.question}</p>
            {e.replies.map((r, i) => (
              <p key={i} className="text-sm text-zinc-500">
                I asked: {r.question} You said: <span className="text-zinc-700 dark:text-zinc-300">{r.reply}</span>
              </p>
            ))}
          </div>
          {e.status === "done" && e.answer ? (
            <AnswerCard answer={e.answer} onAsk={(q) => ask(q, "chip")} askDisabled={busy} />
          ) : e.status === "clarify" && e.clarification ? (
            <ClarifyPrompt clarification={e.clarification} disabled={busy} onReply={(r) => reply(e, r)} />
          ) : e.status === "error" ? (
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
