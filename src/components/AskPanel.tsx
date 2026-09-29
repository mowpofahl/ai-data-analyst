"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AnswerCard from "@/components/AnswerCard";
import HistoryList from "@/components/HistoryList";
import QuestionChips from "@/components/QuestionChips";
import { answerClarification, askQuestion, AskError, type Answer, type AskOutcome, type Clarification } from "@/lib/ask";
import type { DatasetContext } from "@/lib/datasetContext";
import { datasetKey, HISTORY_LIMIT, loadHistory, restoreAnswer, saveHistory, toSaved, type HistoryItem } from "@/lib/history";
import { fetchSuggestions } from "@/lib/suggest";
import { fetchUsage, type UsageInfo } from "@/lib/usage";

type Entry = {
  id: number;
  question: string;
  status: "working" | "clarify" | "done" | "error";
  step: string;
  clarification?: Clarification; // waiting on the user's reply
  replies: { question: string; reply: string }[];
  answer?: Answer;
  error?: string;
  restored?: boolean; // reopened from history
};

type Replies = Entry["replies"];

const scrollToEntry = (id: number) =>
  requestAnimationFrame(() => document.getElementById(`question-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));

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
  const historyKey = useMemo(() => datasetKey(dataset), [dataset]);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory(datasetKey(dataset)));
  const [highlight, setHighlight] = useState<number | null>(null);
  const mobileHistory = useRef<HTMLDetailsElement>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const busy = entries.some((e) => e.status === "working");
  const outOfQuestions = !!usage && (usage.questionsLeft <= 0 || usage.budgetReached);
  const refreshUsage = () => fetchUsage().then((u) => u && setUsage(u));

  // History is saved in this browser only, per dataset.
  useEffect(() => saveHistory(historyKey, dataset.fileName, history), [historyKey, dataset.fileName, history]);

  // The demo's daily question allowance for this visitor.
  useEffect(() => {
    fetchUsage().then((u) => u && setUsage(u));
  }, []);

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

  const settle = async (id: number, question: string, replies: Replies, run: () => Promise<AskOutcome>) => {
    try {
      const outcome = await run();
      if (outcome.kind === "answer") {
        update(id, { status: "done", answer: outcome.answer, clarification: undefined });
        const item: HistoryItem = { id, question, askedAt: new Date().toISOString(), replies, answer: toSaved(outcome.answer) };
        setHistory((prev) => [item, ...prev.filter((h) => h.id !== id)].slice(0, HISTORY_LIMIT));
      } else {
        update(id, { status: "clarify", clarification: outcome.clarification });
      }
    } catch (err) {
      console.error(err);
      update(id, { status: "error", error: err instanceof AskError ? err.message : "Something went wrong. Try again." });
    } finally {
      refreshUsage();
    }
  };

  const ask = (text: string, from: "typed" | "chip") => {
    const q = text.trim();
    if (!q || busy || outOfQuestions) return;
    const id = Date.now();
    setEntries((prev) => [{ id, question: q, status: "working", step: "Starting…", replies: [] }, ...prev]);
    if (from === "typed") setQuestion("");
    else scrollToEntry(id);
    settle(id, q, [], () => askQuestion(q, dataset, (step) => update(id, { step })));
  };

  const reply = (entry: Entry, text: string) => {
    const clarification = entry.clarification;
    if (!clarification || busy) return;
    const replies = [...entry.replies, { question: clarification.question, reply: text }];
    update(entry.id, { status: "working", step: "Using your answer…", clarification: undefined, replies });
    settle(entry.id, entry.question, replies, () => answerClarification(clarification, text, dataset, (step) => update(entry.id, { step })));
  };

  // Reopen a past answer. Its SQL re-runs locally, so there's no AI call.
  const openFromHistory = (item: HistoryItem) => {
    if (!entries.some((e) => e.id === item.id)) {
      const entry: Entry = { id: item.id, question: item.question, status: "working", step: "Restoring from history…", replies: item.replies, restored: true };
      setEntries((prev) => [entry, ...prev]);
      restoreAnswer(item.answer).then((answer) => update(item.id, { status: "done", answer }));
    }
    scrollToEntry(item.id);
    setHighlight(item.id);
    setTimeout(() => setHighlight((h) => (h === item.id ? null : h)), 1600);
  };

  const clearHistory = () => {
    if (window.confirm("Clear the question history for this file? Answers already on the page stay until you reload.")) setHistory([]);
  };

  const asked = new Set(entries.map((e) => e.question));
  const remaining = suggestions?.filter((q) => !asked.has(q)) ?? [];

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="flex min-w-0 flex-col gap-4">
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
          <button type="submit" disabled={busy || outOfQuestions || !question.trim()} className={primaryButton}>
            {busy ? "Working…" : "Ask"}
          </button>
        </form>
        {usage && (
          <p className={`-mt-2 text-xs ${outOfQuestions ? "text-amber-700 dark:text-amber-400" : "text-zinc-500"}`} aria-live="polite">
            {usage.budgetReached
              ? "The demo has reached today's AI budget, so new questions are paused until tomorrow. Filters, charts and your history still work."
              : usage.questionsLeft <= 0
                ? `You've used all ${usage.questionsPerDay} questions for today. They reset at midnight UTC. Filters, charts and your history still work.`
                : `${usage.questionsLeft} of ${usage.questionsPerDay} questions left today.`}
          </p>
        )}

        {suggestions === null ? (
          <p className="animate-pulse text-sm text-zinc-500">Coming up with questions to try…</p>
        ) : (
          remaining.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-zinc-500">Try one of these:</p>
              <QuestionChips questions={remaining} onPick={(q) => ask(q, "chip")} disabled={busy || outOfQuestions} />
            </div>
          )
        )}

        {history.length > 0 && (
          <details ref={mobileHistory} className="rounded-xl border border-zinc-200 px-3 py-2 lg:hidden dark:border-zinc-800">
            <summary className="cursor-pointer text-sm font-medium">History ({history.length})</summary>
            <div className="mt-2">
              <HistoryList
                items={history}
                onOpen={(item) => {
                  if (mobileHistory.current) mobileHistory.current.open = false;
                  openFromHistory(item);
                }}
                onClear={clearHistory}
              />
            </div>
          </details>
        )}

        {entries.map((e) => (
          <article
            key={e.id}
            id={`question-${e.id}`}
            className={`flex scroll-mt-4 flex-col gap-3 rounded-xl border p-4 transition-shadow ${
              highlight === e.id ? "border-indigo-400 ring-2 ring-indigo-400/60" : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="flex flex-col gap-1">
              {e.restored && <p className="text-xs text-zinc-500">From your history</p>}
              <p className="font-medium">{e.question}</p>
              {e.replies.map((r, i) => (
                <p key={i} className="text-sm text-zinc-500">
                  I asked: {r.question} You said: <span className="text-zinc-700 dark:text-zinc-300">{r.reply}</span>
                </p>
              ))}
            </div>
            {e.status === "done" && e.answer ? (
              <AnswerCard answer={e.answer} onAsk={(q) => ask(q, "chip")} askDisabled={busy || outOfQuestions} />
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
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-4 flex max-h-[calc(100vh-2rem)] flex-col gap-2 overflow-y-auto rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="px-2 text-sm font-semibold">History</h3>
          <HistoryList items={history} onOpen={openFromHistory} onClear={clearHistory} />
        </div>
      </aside>
    </section>
  );
}
