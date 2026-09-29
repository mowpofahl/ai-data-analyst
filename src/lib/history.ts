import { runLimited } from "./answerQuery";
import type { Answer } from "./ask";
import type { DatasetContext } from "./datasetContext";

// Question history lives in this browser's localStorage, per dataset. It
// never leaves the device. Results aren't stored: the SQL is re-run locally
// when an answer is restored, so no AI call is needed.

export type SavedAnswer = Omit<Answer, "result" | "resultError" | "truncated">;

export interface HistoryItem {
  id: number;
  question: string;
  askedAt: string; // ISO time
  replies: { question: string; reply: string }[];
  answer: SavedAnswer;
}

type Store = Record<string, { fileName: string; updatedAt: string; items: HistoryItem[] }>;

const STORAGE_KEY = "ai-data-analyst:history:v1";
export const HISTORY_LIMIT = 50; // questions per dataset
const MAX_DATASETS = 10;

// A short fingerprint of the file's name and shape, so the same CSV loaded
// again gets its history back.
export function datasetKey(ctx: DatasetContext): string {
  const text = [ctx.fileName, ctx.rowCount, ...ctx.columns.map((c) => `${c.name}:${c.type}`)].join("|");
  let hash = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  // Keep only the most recently used datasets.
  let keys = Object.keys(store).sort((a, b) => store[b].updatedAt.localeCompare(store[a].updatedAt));
  for (let attempt = 0; attempt < 3; attempt++) {
    const trimmed = Object.fromEntries(keys.slice(0, MAX_DATASETS).map((k) => [k, store[k]]));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return;
    } catch {
      keys = keys.slice(0, Math.max(1, Math.floor(keys.length / 2))); // storage full: drop older datasets
    }
  }
}

const isItem = (v: unknown): v is HistoryItem => {
  const i = v as Partial<HistoryItem> | null;
  return !!i && typeof i.id === "number" && typeof i.question === "string" && typeof i.answer?.sql === "string";
};

export function loadHistory(key: string): HistoryItem[] {
  const items = readStore()[key]?.items;
  return Array.isArray(items) ? items.filter(isItem) : [];
}

export function saveHistory(key: string, fileName: string, items: HistoryItem[]) {
  const store = readStore();
  if (items.length === 0) delete store[key];
  else store[key] = { fileName, updatedAt: new Date().toISOString(), items: items.slice(0, HISTORY_LIMIT) };
  writeStore(store);
}

export function toSaved(a: Answer): SavedAnswer {
  const { answer, sql, confidence, assumptions, chart, filterColumns, queriesRun, followUps } = a;
  return { answer, sql, confidence, assumptions, chart, filterColumns, queriesRun, followUps };
}

// Rebuild a full answer by re-running its SQL on the loaded data.
export async function restoreAnswer(stored: SavedAnswer): Promise<Answer> {
  // Fill in anything an older saved answer might be missing.
  const saved: SavedAnswer = {
    ...stored,
    assumptions: stored.assumptions ?? [],
    chart: stored.chart ?? null,
    filterColumns: stored.filterColumns ?? [],
    followUps: stored.followUps ?? [],
    queriesRun: stored.queriesRun ?? 0,
  };
  try {
    const { result, truncated } = await runLimited(saved.sql);
    return { ...saved, result, truncated, resultError: null };
  } catch (err) {
    return { ...saved, result: null, truncated: false, resultError: (err as Error).message };
  }
}
