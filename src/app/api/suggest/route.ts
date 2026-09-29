import Anthropic from "@anthropic-ai/sdk";
import { describeDataset } from "@/lib/analystPrompt";
import { apiErrorResponse, isDatasetContext, jsonError, logUsage, missingKeyResponse } from "@/lib/claudeServer";
import { SUGGEST_INSTRUCTIONS, SUGGEST_SCHEMA } from "@/lib/suggestPrompt";
import { checkLimits, recordSpend } from "@/lib/usageLimits";

// Starter questions for a freshly loaded dataset. A small, cheap model is
// plenty here: it only reads the column summary and writes four questions.

export const maxDuration = 30;

const MODEL = process.env.ANTHROPIC_SUGGEST_MODEL || "claude-haiku-4-5";
const MAX_BODY_CHARS = 200_000;
const MAX_QUESTIONS = 4;
const MAX_QUESTION_CHARS = 120;

function parseQuestions(response: Anthropic.Message): string[] {
  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) return [];
  try {
    const { questions } = JSON.parse(text) as { questions?: unknown };
    if (!Array.isArray(questions)) return [];
    const clean = questions
      .filter((q): q is string => typeof q === "string")
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && q.length <= MAX_QUESTION_CHARS);
    return [...new Set(clean)].slice(0, MAX_QUESTIONS);
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return jsonError(400, "Request is too large.");
  let dataset: unknown;
  try {
    dataset = (JSON.parse(raw) as { dataset?: unknown }).dataset;
  } catch {
    return jsonError(400, "Request isn't valid JSON.");
  }
  if (!isDatasetContext(dataset)) return jsonError(400, "Missing dataset description.");

  const limit = await checkLimits(request, "suggest");
  if (!limit.ok) return jsonError(429, limit.message);

  const client = new Anthropic();
  try {
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 1024,
        system: SUGGEST_INSTRUCTIONS,
        messages: [{ role: "user", content: describeDataset(dataset) }],
        output_config: { format: { type: "json_schema", schema: SUGGEST_SCHEMA } },
      },
      { signal: request.signal },
    );
    logUsage("suggest", response);
    await recordSpend(request, response.model, response.usage);
    return Response.json({ questions: response.stop_reason === "end_turn" ? parseQuestions(response) : [] });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
