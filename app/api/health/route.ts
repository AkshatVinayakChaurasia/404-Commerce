import { connection } from "next/server";
import { llmAvailable } from "@/lib/engine/llm";
import { dbConfigured } from "@/lib/db/log";
import { getStore, storeProblem } from "@/lib/store";
import { authConfigured } from "@/lib/supabase/config";
import { dataset } from "@/lib/official/adapter";

// What is switched on, so a deploy can be checked in one request. Reports causes,
// never secret values.
export async function GET() {
  // Read env at request time, not build time.
  await connection();
  let problem = dbConfigured() ? null : storeProblem();
  if (!problem) {
    try {
      await getStore().ownedMerchantIds();
    } catch (e) {
      problem = (e as Error).message;
    }
  }
  return Response.json({
    ok: true,
    dataset: dataset.version,
    claude: llmAvailable(),
    database: !problem,
    database_problem: problem,
    login: authConfigured(),
  });
}
