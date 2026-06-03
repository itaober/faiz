import matter from 'gray-matter';

import { putGitHubFile } from '@/lib/data/common';
import { normalizeEditorImageMarkup } from '@/lib/utils/editor-image';

/** Always read fresh (no cache) when about to mutate, to avoid stale SHA / 409s. */
export const createMutationFetchInit = (): RequestInit => ({ cache: 'no-store' });

/** Trimmed string, or '' when the value is missing / blank. */
export const normalizeOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

/** Recursively drop `undefined` entries so they don't serialize into frontmatter. */
const stripUndefinedValues = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedValues).filter(item => item !== undefined);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const cleaned = stripUndefinedValues(item);
        return cleaned === undefined ? [] : [[key, cleaned]];
      }),
    );
  }

  return value;
};

const stringifyMdx = (data: Record<string, unknown>, content: string) =>
  matter.stringify(
    `${normalizeEditorImageMarkup(content).trimEnd()}\n`,
    stripUndefinedValues(data) as Record<string, unknown>,
  );

/** Write a frontmatter+content MDX file to the content repo. */
export const writeMdx = async (
  path: string,
  data: Record<string, unknown>,
  content: string,
  message: string,
  token: string,
) => {
  const mdx = stringifyMdx(data, content);
  await putGitHubFile(
    path,
    {
      contentBase64: Buffer.from(mdx, 'utf8').toString('base64'),
      message,
    },
    token,
  );
};
