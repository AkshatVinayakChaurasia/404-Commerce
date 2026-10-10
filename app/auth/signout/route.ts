import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// POST only, so a link or an image can't sign someone out.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL("/", request.url), { status: 303 });
}
