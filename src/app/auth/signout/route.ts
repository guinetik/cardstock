import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const db = await supabaseServer();
  await db.auth.signOut();
  return NextResponse.redirect(new URL("/login", new URL(request.url).origin), {
    status: 303,
  });
}
