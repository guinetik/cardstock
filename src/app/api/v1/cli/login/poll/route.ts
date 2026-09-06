import { pollCliLogin } from "@/lib/api/cli-login";
import { apiError, apiJson } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Poll a one-time device request; a completed request cannot be replayed. */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const deviceCode =
      raw && typeof raw === "object" && typeof raw.deviceCode === "string"
        ? raw.deviceCode
        : null;
    if (!deviceCode)
      return apiError("invalid_request", "`deviceCode` is required.");
    const credential = await pollCliLogin(deviceCode);
    return credential
      ? apiJson(credential)
      : new Response(null, { status: 204 });
  } catch (error) {
    console.error("cli login poll:", error);
    return apiError("internal", "Something went wrong.");
  }
}
