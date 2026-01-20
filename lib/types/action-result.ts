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

export function createActionError(
  error: unknown,
  fallbackMessage = 'An error occurred',
): ActionError {
  if (error instanceof Error) {
    const message = error.message;

    if (message.includes('401')) {
      return {
        success: false,
        error: 'Invalid GitHub token',
        code: 'AUTH_INVALID',
        retryable: false,
      };
    }
    if (message.includes('403')) {
      return {
        success: false,
        error: 'Rate limit exceeded. Try again in a moment.',
        code: 'RATE_LIMIT',
        retryable: true,
      };
    }
    if (message.includes('404')) {
      return { success: false, error: 'Resource not found', code: 'NOT_FOUND', retryable: false };
    }
    if (message.includes('409')) {
      return {
        success: false,
        error: 'Conflict - data was modified. Please refresh.',
        code: 'CONFLICT',
        retryable: true,
      };
    }

    return { success: false, error: message, code: 'UNKNOWN', retryable: true };
  }

  return { success: false, error: fallbackMessage, code: 'UNKNOWN', retryable: true };
}
