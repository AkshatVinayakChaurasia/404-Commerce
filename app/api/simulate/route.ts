import { simulate, type SimOptions } from "@/lib/engine/simulate";

// POST /api/simulate — offline evaluation over synthetic requests.
export async function POST(request: Request) {
  let opts: SimOptions = {};
  try {
    opts = await request.json();
  } catch {
    // empty body is fine: defaults apply
  }
  return Response.json(simulate(opts));
}
