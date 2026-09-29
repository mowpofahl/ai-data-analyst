import { createHash } from "node:crypto";

// Spending guardrails for the public demo, enforced on the server:
// - each visitor gets QUESTIONS_PER_DAY questions a day (by hashed IP address)
// - all visitors together can spend at most DAILY_BUDGET_USD a day, estimated
//   from the token usage Claude reports on every response
// The Anthropic Console spend limit and prepaid credit remain the hard ceiling.
//
// Counts live in Upstash Redis when it's connected (the Vercel Marketplace
// integration sets the env vars). Without it they fall back to server memory,
// which resets whenever Vercel starts a new server instance.

export const QUESTIONS_PER_DAY = positive(process.env.QUESTIONS_PER_DAY, 10);
const DAILY_BUDGET_USD = positive(process.env.DAILY_BUDGET_USD, 1);
const SUGGESTIONS_PER_DAY = 20; // per visitor; one per file load
const CALLS_PER_DAY = QUESTIONS_PER_DAY * 6; // every Claude call for questions, so one can't be stretched forever
const DAY_SECONDS = 24 * 60 * 60;

// US dollars per million tokens. Cache writes cost 1.25x input and cache reads 0.1x.
const PRICES: [prefix: string, input: number, output: number][] = [
  ["claude-sonnet-5-5", 2, 10],
  ["claude-opus-5-5", 4, 20],
  ["claude-haiku-4-5", 1, 5],
];
const UNKNOWN_MODEL_PRICE = { input: 10, output: 50 }; // assume the priciest tier so the cap errs on the safe side

function positive(value: string | undefined, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------- Counter storage ----------

interface Counters {
  incr(key: string, by: number): Promise<number>;
  get(key: string): Promise<number>;
}

function upstash(url: string, token: string): Counters {
  // Upstash's REST API: POST a list of Redis commands to /pipeline.
  const run = async (commands: (string | number)[][]) => {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(commands),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Upstash returned ${res.status}`);
    const results = (await res.json()) as { result?: unknown; error?: string }[];
    const failed = results.find((r) => r.error);
    if (failed) throw new Error(`Upstash error: ${failed.error}`);
    return results.map((r) => r.result);
  };
  return {
    async incr(key, by) {
      const [value] = await run([["INCRBY", key, by], ["EXPIRE", key, 2 * DAY_SECONDS]]);
      return Number(value);
    },
    async get(key) {
      const [value] = await run([["GET", key]]);
      return Number(value ?? 0);
    },
  };
}

function inMemory(): Counters {
  const counts = new Map<string, { value: number; expires: number }>();
  const read = (key: string) => {
    const entry = counts.get(key);
    return entry && entry.expires > Date.now() ? entry.value : 0;
  };
  return {
    async incr(key, by) {
      const value = read(key) + by;
      counts.set(key, { value, expires: Date.now() + 2 * DAY_SECONDS * 1000 });
      return value;
    },
    async get(key) {
      return read(key);
    },
  };
}

// Find the Upstash credentials. Vercel may add a custom prefix to the names
// (for example STORAGE_KV_REST_API_URL), so match on the ending.
function findRedisEnv(): { url: string; token: string } | null {
  const pairs = [
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
  ];
  const names = Object.keys(process.env).sort((a, b) => a.length - b.length); // exact names first
  for (const [urlName, tokenName] of pairs) {
    for (const name of names) {
      if (!name.endsWith(urlName)) continue;
      const url = process.env[name];
      const token = process.env[name.slice(0, -urlName.length) + tokenName];
      if (url && token) return { url, token };
    }
  }
  return null;
}

let counters: Counters | null = null;
let storage: "database" | "memory" = "memory";
function store(): Counters {
  if (!counters) {
    const redis = findRedisEnv();
    if (redis) {
      counters = upstash(redis.url, redis.token);
      storage = "database";
    } else {
      console.warn("Usage limits are kept in memory. Connect Upstash Redis for limits that hold across server instances.");
      counters = inMemory();
    }
  }
  return counters;
}

// ---------- Keys ----------

const today = () => new Date().toISOString().slice(0, 10); // UTC day

// Visitors are told apart by a hash of their IP address; the IP itself is never stored.
function visitorId(request: Request) {
  const ip = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`ai-data-analyst:${ip}`).digest("hex").slice(0, 20);
}

const keys = (request: Request) => {
  const day = today();
  const visitor = visitorId(request);
  return {
    spend: `spend:${day}`,
    calls: `calls:${day}:${visitor}`,
    questions: `questions:${day}:${visitor}`,
    suggestions: `suggestions:${day}:${visitor}`,
  };
};

const BUDGET_MESSAGE =
  "The demo has reached today's AI budget. Try again tomorrow. The overview, charts and your saved history still work.";
const questionsMessage = () =>
  `You've used all ${QUESTIONS_PER_DAY} questions for today. They reset at midnight UTC, or you can run your own copy from GitHub.`;

// ---------- Checks ----------

export type LimitResult = { ok: true; questionsLeft: number | null; refund: () => Promise<void> } | { ok: false; message: string };

// Call before each Claude request. "question" counts a new question, "continue"
// is a later step of the same question, and "suggest" is a suggestions request.
export async function checkLimits(request: Request, kind: "question" | "continue" | "suggest"): Promise<LimitResult> {
  const k = keys(request);
  try {
    const counts = store();
    if ((await counts.get(k.spend)) >= DAILY_BUDGET_USD * 1_000_000) return { ok: false, message: BUDGET_MESSAGE };

    if (kind === "suggest") {
      if ((await counts.incr(k.suggestions, 1)) > SUGGESTIONS_PER_DAY) return { ok: false, message: "Suggestion limit reached for today." };
      return { ok: true, questionsLeft: null, refund: async () => {} };
    }

    if ((await counts.incr(k.calls, 1)) > CALLS_PER_DAY) return { ok: false, message: questionsMessage() };
    if (kind === "question") {
      const asked = await counts.incr(k.questions, 1);
      if (asked > QUESTIONS_PER_DAY) return { ok: false, message: questionsMessage() };
      // A question that fails before Claude answers shouldn't use up the visitor's allowance.
      return { ok: true, questionsLeft: QUESTIONS_PER_DAY - asked, refund: () => counts.incr(k.questions, -1).then(() => undefined) };
    }
  } catch (err) {
    // If the counter store is down, keep the demo working: the Console spend limit is still the hard stop.
    console.error("Usage limit check failed", err);
  }
  return { ok: true, questionsLeft: null, refund: async () => {} };
}

type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

// Estimated cost in millionths of a dollar (tokens x dollars per million tokens).
export function estimateCostMicros(model: string, usage: Usage): number {
  const match = PRICES.find(([prefix]) => model.startsWith(prefix));
  const price = match ? { input: match[1], output: match[2] } : UNKNOWN_MODEL_PRICE;
  const input =
    usage.input_tokens * price.input +
    (usage.cache_creation_input_tokens ?? 0) * price.input * 1.25 +
    (usage.cache_read_input_tokens ?? 0) * price.input * 0.1;
  return Math.ceil(input + usage.output_tokens * price.output);
}

export async function recordSpend(request: Request, model: string, usage: Usage) {
  try {
    await store().incr(keys(request).spend, estimateCostMicros(model, usage));
  } catch (err) {
    console.error("Recording spend failed", err);
  }
}

// For the page: how many questions this visitor has left today.
export async function usageFor(request: Request) {
  const k = keys(request);
  try {
    const [asked, spent] = await Promise.all([store().get(k.questions), store().get(k.spend)]);
    return {
      questionsPerDay: QUESTIONS_PER_DAY,
      questionsLeft: Math.max(0, QUESTIONS_PER_DAY - asked),
      budgetReached: spent >= DAILY_BUDGET_USD * 1_000_000,
      storage, // "database" when Upstash is connected; shown so the setup can be checked
    };
  } catch (err) {
    console.error("Usage lookup failed", err);
    return {
      questionsPerDay: QUESTIONS_PER_DAY,
      questionsLeft: QUESTIONS_PER_DAY,
      budgetReached: false,
      storage: "database not reachable",
      storageError: (err as Error).message,
    };
  }
}
