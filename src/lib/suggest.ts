import type { DatasetContext } from "./datasetContext";

// Starter questions for a dataset. Returns [] when the AI isn't available, so
// the app simply shows no suggestions.
export async function fetchSuggestions(dataset: DatasetContext, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch("/api/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset }),
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { questions?: unknown } | null;
  return Array.isArray(data?.questions) ? data.questions.filter((q): q is string => typeof q === "string") : [];
}
