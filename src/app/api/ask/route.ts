import Anthropic from "@anthropic-ai/sdk";
import { describeDataset, INSTRUCTIONS, TOOLS } from "@/lib/analystPrompt";
import { apiErrorResponse, isDatasetContext, jsonError, logUsage, missingKeyResponse } from "@/lib/claudeServer";
import type { DatasetContext } from "@/lib/datasetContext";

// One step of the analyst loop. The browser owns the loop: it sends the
// conversation so far, we add the instructions and call Claude, and the
// browser runs any SQL Claude asks for and sends the results back.

export const maxDuration = 60;

// Sonnet 5.5: fast and strong at SQL, about half the cost of Opus 5.5.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const MAX_BODY_CHARS = 300_000;
const MAX_MESSAGES = 30;
const MAX_QUESTION_CHARS = 1_000;

type Body = { dataset: DatasetContext; messages: Anthropic.Beta.BetaMessageParam[] };

function parseBody(raw: string): Body | string {
  if (raw.length > MAX_BODY_CHARS) return "Request is too large.";
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return "Request isn't valid JSON.";
  }
  const { dataset, messages } = (body ?? {}) as Partial<Body>;
  if (!isDatasetContext(dataset)) return "Missing dataset description.";
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    return "Missing or too many messages.";
  }
  const first = messages[0];
  if (first.role !== "user" || typeof first.content !== "string" || first.content.length > MAX_QUESTION_CHARS) {
    return "The first message must be the question, up to 1,000 characters.";
  }
  return { dataset, messages };
}

export async function POST(request: Request) {
  const noKey = missingKeyResponse();
  if (noKey) return noKey;

  const body = parseBody(await request.text());
  if (typeof body === "string") return jsonError(400, body);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: [
          { type: "text", text: INSTRUCTIONS },
          { type: "text", text: describeDataset(body.dataset) },
        ],
        tools: TOOLS,
        messages: body.messages,
      },
      { signal: request.signal },
    );
    logUsage("ask", response);

    return Response.json({
      content: response.content,
      stop_reason: response.stop_reason,
      model: response.model,
      usage: response.usage,
    });
  } catch (err) {
    return apiErrorResponse(err);
  }
}
