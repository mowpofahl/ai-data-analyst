"use client";

import { useMemo, useState } from "react";
import AskPanel from "@/components/AskPanel";
import { ColumnsTable, PreviewTable, StatsRow } from "@/components/DatasetOverview";
import PrivacyNote from "@/components/PrivacyNote";
import QualityWarnings from "@/components/QualityWarnings";
import Uploader, { MAX_FILE_MB } from "@/components/Uploader";
import { loadCsv } from "@/lib/duckdb";
import { toDatasetContext } from "@/lib/datasetContext";
import { profileDataset, type DatasetProfile } from "@/lib/profile";
import { btnGhost, card, sectionLabel, tag } from "@/lib/ui";

type State =
  | { status: "idle" }
  | { status: "loading"; fileName: string }
  | { status: "ready"; profile: DatasetProfile }
  | { status: "error"; message: string };

const STEPS = [
  {
    title: "Upload a CSV",
    body: "The file loads into DuckDB, a SQL database that runs right in your browser. It never gets uploaded anywhere.",
  },
  {
    title: "Ask in plain English",
    body: "Claude reads the column summary, writes SQL and runs it on your data. If a question is ambiguous, it asks you first.",
  },
  {
    title: "Get an honest answer",
    body: "A short answer with a chart, the exact SQL it used, a confidence level and any assumptions it made.",
  },
  {
    title: "Keep exploring",
    body: "Filter the chart without another AI call, click a follow-up question, export the chart, or reopen past answers.",
  },
];

const STACK = ["Claude API", "Next.js", "TypeScript", "DuckDB-WASM", "Recharts", "Tailwind CSS", "Vercel"];

function Landing({ state, onFile, onSample }: { state: State; onFile: (f: File) => void; onSample: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col px-4 sm:px-8">
      <section className="grid items-center gap-12 pt-28 pb-8 lg:min-h-[70vh] lg:grid-cols-[1.15fr_1fr]">
        <div className="flex flex-col">
          <p className="mb-7 flex items-center gap-2.5 font-mono text-[0.72rem] uppercase tracking-[0.12em] text-accent">
            <span className="pulse-dot" aria-hidden />
            AI product · Built with Claude
          </p>
          <h1 className="text-gradient text-6xl leading-none font-bold tracking-[-0.03em] sm:text-7xl lg:text-8xl">AI Analyst</h1>
          <p className="mt-5 text-xl text-muted sm:text-2xl">Ask your data questions in plain English.</p>
          <p className="mt-5 max-w-lg leading-relaxed text-muted">
            Drop in a CSV and ask anything. Claude writes the SQL, your browser runs it, and you get an answer with a chart, the
            exact query behind it and an honest read on how confident it is.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2" aria-label="Built with">
            {STACK.map((s) => (
              <li key={s} className={tag}>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <Uploader
          onFile={onFile}
          onSample={onSample}
          loading={state.status === "loading" ? state.fileName : null}
          error={state.status === "error" ? state.message : null}
        />
      </section>

      <section id="how-it-works" className="scroll-mt-24 py-12">
        <p className={sectionLabel}>{"// how it works"}</p>
        <h2 className="mt-3 mb-10 text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">From question to answer in seconds</h2>
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className={`${card} flex flex-col gap-3 p-6 transition hover:border-line-strong hover:bg-card-hover`}>
              <span className="font-mono text-3xl font-bold text-accent">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8">
          <PrivacyNote />
        </div>
      </section>
    </main>
  );
}

export default function Home() {
  const [state, setState] = useState<State>({ status: "idle" });
  // Stable per dataset, so the ask panel only fetches suggestions once per file.
  const dataset = useMemo(() => (state.status === "ready" ? toDatasetContext(state.profile) : null), [state]);

  const analyze = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setState({ status: "error", message: "Please upload a .csv file." });
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setState({ status: "error", message: `That file is over ${MAX_FILE_MB} MB. Try a smaller one.` });
      return;
    }
    setState({ status: "loading", fileName: file.name });
    try {
      await loadCsv(file);
      setState({ status: "ready", profile: await profileDataset(file.name) });
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      setState({
        status: "error",
        message: "We couldn't read that file. Check that it's a valid CSV with a header row.",
      });
    }
  };

  const loadSample = async () => {
    try {
      const res = await fetch("/samples/sales.csv");
      const blob = await res.blob();
      await analyze(new File([blob], "sales.csv", { type: "text/csv" }));
    } catch {
      setState({ status: "error", message: "Couldn't load the sample dataset." });
    }
  };

  if (state.status !== "ready" || !dataset) return <Landing state={state} onFile={analyze} onSample={loadSample} />;

  const { profile } = state;
  return (
    <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-10 px-4 pt-28 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className={sectionLabel}>{"// dataset"}</p>
          <h1 className="mt-2 font-mono text-2xl font-bold break-all">{profile.fileName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#ask" className={btnGhost}>
            Jump to questions ↓
          </a>
          <button type="button" onClick={() => setState({ status: "idle" })} className={btnGhost}>
            Upload a different file
          </button>
        </div>
      </header>

      <StatsRow profile={profile} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ColumnsTable profile={profile} />
        <QualityWarnings warnings={profile.warnings} />
      </div>

      <PreviewTable profile={profile} />

      <AskPanel key={profile.fileName + profile.rowCount} dataset={dataset} />

      <PrivacyNote />
    </main>
  );
}
