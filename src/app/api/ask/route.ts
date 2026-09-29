import Anthropic from "@anthropic-ai/sdk";
import { describeDataset, INSTRUCTIONS, TOOLS } from "@/lib/analystPrompt";
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

function error(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

function parseBody(raw: string): Body | string {
  if (raw.length > MAX_BODY_CHARS) return "Request is too large.";
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return "Request isn't valid JSON.";
  }
  const { dataset, messages } = (body ?? {}) as Partial<Body>;
  if (!dataset || typeof dataset.fileName !== "string" || !Array.isArray(dataset.columns)) {
    return "Missing dataset description.";
  }
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
  if (!process.env.ANTHROPIC_API_KEY) {
    return error(503, "The AI isn't connected yet: this deployment has no Anthropic API key.");
  }

  const body = parseBody(await request.text());
  if (typeof body === "string") return error(400, body);

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
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
    });

    // Shows up in the Vercel logs, so real cost per question can be tracked.
    console.log("claude usage", {
      model: response.model,
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens,
      cacheWrite: response.usage.cache_creation_input_tokens,
    });

    return Response.json({
      content: response.content,
      stop_reason: response.stop_reason,
      model: response.model,
      usage: response.usage,
    });
  } catch (err) {
    console.error("Claude request failed", err);
    if (err instanceof Anthropic.AuthenticationError) {
      return error(500, "The server's Anthropic API key was rejected.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      return error(429, "The AI is getting too many requests right now. Try again in a minute.");
    }
    if (err instanceof Anthropic.BadRequestError) {
      return error(502, "The AI couldn't process this request. If it keeps happening, the demo's usage limit may have been reached.");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return error(502, "Couldn't reach the AI service. Try again in a moment.");
    }
    if (err instanceof Anthropic.APIError) {
      return error(502, "The AI service had a problem. Try again in a moment.");
    }
    return error(500, "Something went wrong on the server.");
  }
}
