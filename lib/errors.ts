/**
 * Raised when the storage API answers with a non-2xx status. Carries the status so callers can
 * branch on it instead of grepping the message — keys and slugs end up in these messages, and a
 * slug containing "404" must not read as a missing resource.
 */
export class StorageError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'StorageError';
    this.status = status;
  }
}

/**
 * Raised when a record is missing from a file we just read — a memo id that is gone, say. Typed
 * so actions stop matching on the message.
 */
export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Raised when content would not compile as MDX, which would break the page that shows it. The
 * message is meant for the editor and quotes the line the error is on, when known: line numbers
 * would count the stored text, not what the Markdown view shows.
 */
export class InvalidMdxError extends Error {
  readonly near?: string;

  constructor(near?: string) {
    super(near ? `Can't save: invalid MDX near “${near}”` : "Can't save: this isn't valid MDX");
    this.name = 'InvalidMdxError';
    this.near = near;
  }
}
