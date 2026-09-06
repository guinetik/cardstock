/** Every failure the API admits to. One code, one status, no exceptions. */
export type ApiCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid_request"
  | "conflict"
  | "rate_limited"
  | "internal";

const status: Record<ApiCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  invalid_request: 422,
  conflict: 409,
  rate_limited: 429,
  internal: 500,
};

/** `details` is structured information a CLI can act on, never an exception. */
export function apiError(
  code: ApiCode,
  message: string,
  details?: unknown,
): Response {
  return Response.json(
    {
      error:
        details === undefined ? { code, message } : { code, message, details },
    },
    { status: status[code] },
  );
}

export function apiJson(body: unknown, init?: ResponseInit): Response {
  return Response.json(body, init);
}
