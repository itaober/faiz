export const EDITABLE_PAGES = ['about', 'lines'] as const;
export type EditablePage = (typeof EDITABLE_PAGES)[number];

export const RECORD_TYPES = ['book', 'movie', 'tv', 'music', 'game'] as const;
export type EditableRecordType = (typeof RECORD_TYPES)[number];

export const CONTENT_IMAGE_SCOPES = ['memos', 'posts', 'pages', 'records'] as const;
export type ContentImageScope = (typeof CONTENT_IMAGE_SCOPES)[number];

export const CONTENT_IMAGE_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png', 'gif'] as const;
export type ContentImageExtension = (typeof CONTENT_IMAGE_EXTENSIONS)[number];

const createLiteralSet = <T extends readonly string[]>(values: T) => new Set<string>(values);

const editablePageSet = createLiteralSet(EDITABLE_PAGES);
const recordTypeSet = createLiteralSet(RECORD_TYPES);
const contentImageScopeSet = createLiteralSet(CONTENT_IMAGE_SCOPES);
const contentImageExtensionSet = createLiteralSet(CONTENT_IMAGE_EXTENSIONS);

export const isEditablePage = (value: unknown): value is EditablePage =>
  typeof value === 'string' && editablePageSet.has(value);

export const isRecordType = (value: unknown): value is EditableRecordType =>
  typeof value === 'string' && recordTypeSet.has(value);

export const isContentImageScope = (value: unknown): value is ContentImageScope =>
  typeof value === 'string' && contentImageScopeSet.has(value);

export const isContentImageExtension = (value: unknown): value is ContentImageExtension =>
  typeof value === 'string' && contentImageExtensionSet.has(value.toLowerCase());

export const normalizeContentImagePath = (value: string) =>
  value.normalize('NFKC').trim().replace(/^\/+/, '').replace(/\/+/g, '/');

export const getImageExtensionFromMimeType = (mimeType: string): ContentImageExtension | null => {
  const normalized = mimeType.split(';')[0]?.trim().toLowerCase();

  if (normalized === 'image/webp') {
    return 'webp';
  }
  if (normalized === 'image/jpeg' || normalized === 'image/jpg') {
    return 'jpg';
  }
  if (normalized === 'image/png') {
    return 'png';
  }
  if (normalized === 'image/gif') {
    return 'gif';
  }

  return null;
};

export const isSafeContentImagePath = (
  value: unknown,
  scope?: ContentImageScope,
): value is string => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = normalizeContentImagePath(value);
  const match = normalized.match(/^assets\/([^/]+)\/([\p{L}\p{N}_-]+)\.(webp|jpe?g|png|gif)$/u);

  if (!match) {
    return false;
  }

  const [, matchedScope, , extension] = match;
  return (
    isContentImageScope(matchedScope) &&
    isContentImageExtension(extension) &&
    (!scope || matchedScope === scope)
  );
};

/**
 * Guard for the read-side image proxy. Deliberately looser than
 * `isSafeContentImagePath`: that one validates paths we generate, while this one
 * has to accept every filename already committed to the content repo — spaces
 * and full-width punctuation included. It also skips NFKC normalization, which
 * would rewrite `：` to `:` and stop the path from resolving on GitHub.
 *
 * Safety here only needs three things: stay inside `assets/`, no traversal, and
 * a raster image extension (so `data/*.json`, `*.mdx` and inline-renderable SVG
 * stay unreachable).
 */
export const isContentImageReadPath = (segments: string[]) => {
  if (segments.length < 2 || segments[0] !== 'assets') {
    return false;
  }

  // A decoded %2F or %5C would smuggle extra path levels through a single segment.
  const hasUnsafeSegment = segments.some(
    segment =>
      !segment ||
      segment === '.' ||
      segment === '..' ||
      segment.includes('/') ||
      segment.includes('\\'),
  );
  if (hasUnsafeSegment) {
    return false;
  }

  const extension = segments[segments.length - 1]?.split('.').pop();
  return extension !== undefined && isContentImageExtension(extension);
};

export const normalizeImagePathList = (value: unknown, scope?: ContentImageScope) => {
  const paths: string[] = [];
  const invalid: unknown[] = [];
  const seen = new Set<string>();

  if (value === undefined || value === null) {
    return { invalid, paths };
  }

  if (!Array.isArray(value)) {
    return { invalid: [value], paths };
  }

  for (const item of value) {
    if (typeof item !== 'string') {
      invalid.push(item);
      continue;
    }

    const normalized = normalizeContentImagePath(item);
    if (!isSafeContentImagePath(normalized, scope)) {
      invalid.push(normalized);
      continue;
    }

    if (!seen.has(normalized)) {
      seen.add(normalized);
      paths.push(normalized);
    }
  }

  return { invalid, paths };
};
