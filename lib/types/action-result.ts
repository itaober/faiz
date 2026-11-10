// Relative + explicit extension so tests/ can import this under bare Node's TS
// type-stripping, which does not resolve the `@/` alias.
import { NotFoundError, StorageError } from '../errors.ts';

export type ActionErrorCode =
  | 'AUTH_INVALID'
  | 'AUTH_EXPIRED'
  | 'RATE_LIMIT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'NETWORK'
  | 'UNKNOWN';

export interface ActionError {
  success: false;
  error: string;
  code: ActionErrorCode;
  retryable: boolean;
}

export type ActionResult<T = void> = { success: true; data?: T } | ActionError;

/** Shared VALIDATION error builder used across all content actions. */
export const validationError = (error: string): ActionError => ({
  success: false,
  error,
  code: 'VALIDATION',
  retryable: false,
});

/** For the "we read the file and the row isn't in it" checks inside actions. */
export const notFoundError = (error: string): ActionError => ({
  success: false,
  error,
  code: 'NOT_FOUND',
  retryable: false,
});

export function createActionError(
  error: unknown,
  fallbackMessage = 'An error occurred',
): ActionError {
  if (error instanceof NotFoundError) {
    return { success: false, error: error.message, code: 'NOT_FOUND', retryable: false };
  }

  // Classify on the status, never the message: messages carry keys and slugs, so a slug like
  // "top-404-pages" must not be reported as a missing resource.
  if (error instanceof StorageError) {
    switch (error.status) {
      case 404:
        return { success: false, error: 'Resource not found', code: 'NOT_FOUND', retryable: false };
      case 412:
        return {
          success: false,
          error: 'Conflict - data was modified. Please refresh.',
          code: 'CONFLICT',
          retryable: true,
        };
      case 429:
      case 503:
        return {
          success: false,
          error: 'Storage is busy. Try again in a moment.',
          code: 'RATE_LIMIT',
          retryable: true,
        };
    }
  }

  // Don't surface the raw message for unclassified errors — it can leak storage keys and bucket
  // names. The full error is still logged server-side by the action's catch block.
  return { success: false, error: fallbackMessage, code: 'UNKNOWN', retryable: true };
}
