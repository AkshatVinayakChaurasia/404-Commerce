import { connection } from "next/server";
import { llmAvailable } from "@/lib/engine/llm";

export async function GET() {
  // Read the key at request time, not build time.
  await connection();
  return Response.json({ ok: true, claude: llmAvailable() });
}
