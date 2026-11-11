export const EDITABLE_PAGES = ['about', 'lines'] as const;
export type EditablePage = (typeof EDITABLE_PAGES)[number];

export const RECORD_TYPES = ['book', 'movie', 'tv', 'music', 'game'] as const;
export type EditableRecordType = (typeof RECORD_TYPES)[number];

/** Folders the editors upload into; each is also the first segment of the asset key. */
export const CONTENT_IMAGE_SCOPES = ['memos', 'posts', 'pages', 'records'] as const;
export type ContentImageScope = (typeof CONTENT_IMAGE_SCOPES)[number];

/** Every folder an asset key may start with: upload scopes plus site-wide files (the avatar). */
const ASSET_FOLDERS = new Set<string>([...CONTENT_IMAGE_SCOPES, 'site']);

/** Upper bound on memo body length, shared by the create and update actions. */
export const MAX_MEMO_CONTENT_LENGTH = 10000;

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
  const match = normalized.match(/^([^/]+)\/([\p{L}\p{N}_-]+)\.(webp|jpe?g|png|gif)$/u);

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
 * Guard for reading an asset key that content already holds. Deliberately looser than
 * `isSafeContentImagePath`: that one validates keys we generate, while this one has to accept
 * every filename already stored — spaces and full-width punctuation included — so it skips NFKC
 * normalization, which would rewrite `：` to `:` and miss the object.
 *
 * Safety only needs three things: a known top-level folder, no traversal, and a raster image
 * extension.
 */
export const isAssetImageKey = (key: string) => {
  const segments = key.split('/');
  if (segments.length < 2 || !ASSET_FOLDERS.has(segments[0])) {
    return false;
  }

  const hasUnsafeSegment = segments.some(
    segment => !segment || segment === '.' || segment === '..' || segment.includes('\\'),
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
