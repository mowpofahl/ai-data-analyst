"use client";

import { useState } from "react";
import DatasetOverview from "@/components/DatasetOverview";
import PrivacyNote from "@/components/PrivacyNote";
import QualityWarnings from "@/components/QualityWarnings";
import Uploader, { MAX_FILE_MB } from "@/components/Uploader";
import { loadCsv } from "@/lib/duckdb";
import { profileDataset, type DatasetProfile } from "@/lib/profile";

type State =
  | { status: "idle" }
  | { status: "loading"; fileName: string }
  | { status: "ready"; profile: DatasetProfile }
  | { status: "error"; message: string };

export default function Home() {
  const [state, setState] = useState<State>({ status: "idle" });

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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">AI Data Analyst</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Upload a CSV, get an instant overview, and ask questions about it in plain English.
        </p>
      </header>

      {state.status === "ready" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">
              Analyzing <span className="font-mono text-zinc-800 dark:text-zinc-200">{state.profile.fileName}</span>
            </p>
            <button
              type="button"
              onClick={() => setState({ status: "idle" })}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Upload a different file
            </button>
          </div>
          <DatasetOverview profile={state.profile} />
          <QualityWarnings warnings={state.profile.warnings} />
          <section className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            Asking questions about your data is coming next.
          </section>
        </>
      ) : (
        <>
          <Uploader onFile={analyze} onSample={loadSample} disabled={state.status === "loading"} />
          {state.status === "loading" && (
            <p className="text-center text-sm text-zinc-500" aria-live="polite">
              Loading {state.fileName} and profiling columns…
            </p>
          )}
          {state.status === "error" && (
            <p className="text-center text-sm text-red-600 dark:text-red-400" role="alert">
              {state.message}
            </p>
          )}
        </>
      )}

      <PrivacyNote />
    </main>
  );
}
