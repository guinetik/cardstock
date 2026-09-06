"use server";

import { redirect } from "next/navigation";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export async function approveCliLogin(userCode: string) {
  const member = await currentMember();
  if (!member) redirect(`/login?next=/cli/approve/${userCode}`);
  const db = await supabaseServer();
  const { data, error } = await db.rpc("approve_cli_login", {
    p_user_code: userCode,
  });
  if (error) throw new Error(error.message);
  redirect(data ? "/cli/approved" : `/cli/approve/${userCode}?error=expired`);
}
