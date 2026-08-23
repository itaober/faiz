/**
 * Raised when the GitHub Contents API answers with a non-2xx status. Carries the
 * status so callers can branch on it instead of grepping the message — post
 * slugs and file paths end up in these messages, and a slug containing "404"
 * used to be misread as a missing resource.
 */
export class GitHubApiError extends Error {
  readonly status: number;
  /** True only for an actual quota exhaustion, not every 403. */
  readonly rateLimited: boolean;

  constructor(status: number, message: string, options?: { rateLimited?: boolean }) {
    super(message);
    this.name = 'GitHubApiError';
    this.status = status;
    this.rateLimited = options?.rateLimited ?? false;
  }
}

/**
 * Raised when a record exists in the repo but not in the file we just read —
 * a memo id that is gone, say. Typed so actions stop matching on the message.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export const gitHubApiError = (res: Response, context: string) =>
  new GitHubApiError(res.status, `${context}: ${res.status} ${res.statusText}`, {
    // GitHub answers 403 both for "out of quota" and "token lacks permission";
    // only the former is worth retrying, and the headers are what tell them apart.
    rateLimited: res.status === 429 || res.headers.get('x-ratelimit-remaining') === '0',
  });
