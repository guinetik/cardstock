import { POLL_INTERVAL_SECONDS, startCliLogin } from "@/lib/api/cli-login";
import { apiError, apiJson } from "@/lib/api/errors";

export const runtime = "nodejs";

/** Start a short-lived browser approval request for a CLI installation. */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const deviceName =
      raw && typeof raw === "object" && typeof raw.deviceName === "string"
        ? raw.deviceName.trim().slice(0, 80)
        : "Cardstock CLI";
    const requestCode = await startCliLogin(deviceName || "Cardstock CLI");
    const origin = new URL(request.url).origin;
    const verificationUri = `${origin}/cli/approve/${requestCode.userCode}`;
    return apiJson({
      deviceCode: requestCode.deviceCode,
      userCode: requestCode.userCode,
      verificationUri,
      verificationUriComplete: verificationUri,
      expiresIn: 600,
      interval: POLL_INTERVAL_SECONDS,
    });
  } catch (error) {
    console.error("cli login start:", error);
    return apiError("internal", "Something went wrong.");
  }
}
