import Anthropic from "@anthropic-ai/sdk";
import type { DatasetContext } from "./datasetContext";

// Shared by the API routes: they run on the server, where the API key lives.

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export function missingKeyResponse() {
  return process.env.ANTHROPIC_API_KEY
    ? null
    : jsonError(503, "The AI isn't connected yet: this deployment has no Anthropic API key.");
}

export function isDatasetContext(value: unknown): value is DatasetContext {
  const d = value as Partial<DatasetContext> | null;
  return !!d && typeof d.fileName === "string" && typeof d.rowCount === "number" && Array.isArray(d.columns);
}

// Shows up in the Vercel logs, so real cost per call can be tracked.
export function logUsage(route: string, response: { model: string; usage: Anthropic.Usage | Anthropic.Beta.BetaUsage }) {
  console.log("claude usage", {
    route,
    model: response.model,
    input: response.usage.input_tokens,
    output: response.usage.output_tokens,
    cacheRead: response.usage.cache_read_input_tokens,
    cacheWrite: response.usage.cache_creation_input_tokens,
  });
}

// Turn an SDK error into a message that's safe and useful to show a visitor.
export function apiErrorResponse(err: unknown) {
  console.error("Claude request failed", err);
  if (err instanceof Anthropic.AuthenticationError) {
    return jsonError(500, "The server's Anthropic API key was rejected.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return jsonError(429, "The AI is getting too many requests right now. Try again in a minute.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    return jsonError(502, "The AI couldn't process this request. If it keeps happening, the demo's usage limit may have been reached.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return jsonError(502, "Couldn't reach the AI service. Try again in a moment.");
  }
  if (err instanceof Anthropic.APIError) {
    return jsonError(502, "The AI service had a problem. Try again in a moment.");
  }
  return jsonError(500, "Something went wrong on the server.");
}
