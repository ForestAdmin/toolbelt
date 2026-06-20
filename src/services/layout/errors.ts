/** Errors raised by the layout commands' HTTP adapter. */

/** A non-2xx response from a layout endpoint, normalized to status + detail. */
export class LayoutApiError extends Error {
  /** Best-effort human-readable explanation extracted from the response body. */
  readonly detail: string;

  /** HTTP status code (0 when the request never reached the server). */
  readonly status: number;

  constructor(status: number, detail: string) {
    super(`Forest API error ${status}: ${detail}`);
    this.name = 'LayoutApiError';
    this.status = status;
    this.detail = detail;
  }
}

/** Extract a readable message from a JSON:API error document (or raw text). */
export function extractDetail(body: unknown): string {
  if (body && typeof body === 'object') {
    const parsed = body as {
      errors?: Array<{ detail?: string; message?: string }>;
      message?: string;
    };
    if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      const first = parsed.errors[0];

      return first?.detail || first?.message || JSON.stringify(body);
    }

    if (parsed.message) return parsed.message;
  }

  return typeof body === 'string' && body ? body : 'no response body';
}

/** Turn a superagent error into a {@link LayoutApiError} (status + readable detail). */
export function toLayoutApiError(error: unknown): LayoutApiError {
  const superagentError = error as {
    response?: { body?: unknown; text?: string };
    status?: number;
  };
  const status = superagentError.status ?? 0;
  const body = superagentError.response?.body ?? superagentError.response?.text;

  return new LayoutApiError(status, extractDetail(body));
}
