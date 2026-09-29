import { usageFor } from "@/lib/usageLimits";

// How many questions this visitor has left today. Reads counters only; no AI call.
export async function GET(request: Request) {
  return Response.json(await usageFor(request), { headers: { "Cache-Control": "no-store" } });
}
