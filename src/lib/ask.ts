import type Anthropic from "@anthropic-ai/sdk";
import type { DatasetContext } from "./datasetContext";
import { query, type QueryResult } from "./duckdb";
import { checkSql } from "./sqlGuard";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlock;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export type Confidence = "high" | "medium" | "low";

export interface Answer {
  answer: string;
  sql: string;
  confidence: Confidence;
  assumptions: string[];
  result: QueryResult | null; // the answer's SQL, re-run locally for display
  resultError: string | null;
  truncated: boolean;
  queriesRun: number;
}

const MAX_ROUNDS = 8; // Claude calls per question
const RESULT_ROWS_FOR_AI = 50;
const RESULT_ROWS_MAX = 1000;
const MAX_CELL_CHARS = 200;

export class AskError extends Error {}

// Run a checked query, capping how many rows come back into memory.
async function runLimited(sql: string): Promise<{ result: QueryResult; truncated: boolean }> {
  const check = checkSql(sql);
  if (!check.ok) throw new Error(check.reason);
  const result = await query(`SELECT * FROM (${check.sql}) AS q LIMIT ${RESULT_ROWS_MAX + 1}`);
  const truncated = result.rows.length > RESULT_ROWS_MAX;
  if (truncated) result.rows = result.rows.slice(0, RESULT_ROWS_MAX);
  return { result, truncated };
}

function summarizeForAi({ result, truncated }: { result: QueryResult; truncated: boolean }): string {
  const rows = result.rows.slice(0, RESULT_ROWS_FOR_AI).map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = typeof v === "string" && v.length > MAX_CELL_CHARS ? `${v.slice(0, MAX_CELL_CHARS)}…` : v;
    }
    return out;
  });
  return JSON.stringify({
    columns: result.columns,
    row_count: truncated ? `more than ${RESULT_ROWS_MAX}` : result.rows.length,
    rows,
    ...(result.rows.length > RESULT_ROWS_FOR_AI ? { note: `Only the first ${RESULT_ROWS_FOR_AI} rows are shown.` } : {}),
  });
}

async function callClaude(dataset: DatasetContext, messages: MessageParam[]) {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset, messages }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new AskError(data?.error ?? "The AI request failed. Try again.");
  return data as { content: ContentBlock[]; stop_reason: string | null };
}

function parseAnswer(input: unknown): Omit<Answer, "result" | "resultError" | "truncated" | "queriesRun"> | null {
  const a = input as Partial<Answer> | null;
  if (!a || typeof a.answer !== "string" || typeof a.sql !== "string") return null;
  const confidence: Confidence = a.confidence === "high" || a.confidence === "low" ? a.confidence : "medium";
  const assumptions = Array.isArray(a.assumptions) ? a.assumptions.filter((s): s is string => typeof s === "string") : [];
  return { answer: a.answer, sql: a.sql, confidence, assumptions };
}

// Answer a question: Claude writes SQL, the browser runs it, and the loop
// repeats until Claude submits a final answer.
export async function askQuestion(
  question: string,
  dataset: DatasetContext,
  onStep: (step: string) => void,
): Promise<Answer> {
  const messages: MessageParam[] = [{ role: "user", content: question }];
  let queriesRun = 0;

  for (let round = 0; round < MAX_ROUNDS; round++) {
    onStep(round === 0 ? "Reading your question…" : "Looking at the results…");
    const response = await callClaude(dataset, messages);

    if (response.stop_reason === "refusal") {
      throw new AskError("The AI declined to answer this question. Try rephrasing it.");
    }
    if (response.stop_reason === "max_tokens") {
      throw new AskError("The AI's response was cut off. Try a simpler question.");
    }

    // Keep Claude's turn exactly as returned (including thinking blocks).
    messages.push({ role: "assistant", content: response.content });
    const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");

    const submit = toolUses.find((t) => t.name === "submit_answer");
    if (submit) {
      const parsed = parseAnswer(submit.input);
      if (!parsed) throw new AskError("The AI returned an answer in an unexpected format. Try again.");
      onStep("Preparing the results table…");
      try {
        const { result, truncated } = await runLimited(parsed.sql);
        return { ...parsed, result, truncated, resultError: null, queriesRun };
      } catch (err) {
        return { ...parsed, result: null, truncated: false, resultError: (err as Error).message, queriesRun };
      }
    }

    if (toolUses.length === 0) {
      // Claude replied in plain text; ask for the structured answer.
      messages.push({ role: "user", content: "Please give your final answer with the submit_answer tool." });
      continue;
    }

    const results: ToolResult[] = [];
    for (const tool of toolUses) {
      if (tool.name !== "run_sql") {
        results.push({ type: "tool_result", tool_use_id: tool.id, is_error: true, content: `Unknown tool ${tool.name}.` });
        continue;
      }
      const { sql, purpose } = tool.input as { sql?: unknown; purpose?: unknown };
      onStep(typeof purpose === "string" && purpose ? `Running query: ${purpose}` : "Running a query…");
      queriesRun++;
      try {
        if (typeof sql !== "string") throw new Error("Missing sql.");
        results.push({ type: "tool_result", tool_use_id: tool.id, content: summarizeForAi(await runLimited(sql)) });
      } catch (err) {
        results.push({ type: "tool_result", tool_use_id: tool.id, is_error: true, content: `Query failed: ${(err as Error).message}` });
      }
    }
    messages.push({ role: "user", content: results });
  }

  throw new AskError("The AI took too many steps on this question. Try asking something more specific.");
}
