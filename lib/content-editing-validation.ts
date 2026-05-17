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
