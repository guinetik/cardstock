import { revokeCliLogin } from "@/lib/api/cli-login";
import { apiError } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    if (!(await revokeCliLogin(request.headers.get("authorization"))))
      return apiError("unauthenticated", "Provide a valid CLI token.");
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("cli logout:", error);
    return apiError("internal", "Something went wrong.");
  }
}
