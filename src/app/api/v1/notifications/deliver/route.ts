import { timingSafeEqual } from "node:crypto";
import { deliverWatchMail } from "@/lib/watch-mail";

export const maxDuration = 60;

/** Call every minute from the deployment scheduler; no user session is needed. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await deliverWatchMail());
}

export const GET = POST;
