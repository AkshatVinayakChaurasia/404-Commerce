import { connection } from "next/server";
import { llmAvailable } from "@/lib/engine/llm";
import { dbConfigured } from "@/lib/db/log";
import { storeProblem } from "@/lib/store";
import { authConfigured } from "@/lib/supabase/config";
import { dataset } from "@/lib/official/adapter";

// What is switched on, so a deploy can be checked in one request.
export async function GET() {
  // Read env at request time, not build time.
  await connection();
  return Response.json({
    ok: true,
    dataset: dataset.version,
    claude: llmAvailable(),
    database: dbConfigured(),
    database_problem: dbConfigured() ? null : storeProblem(),
    login: authConfigured(),
  });
}
