import matter from 'gray-matter';

import { transformOutsideMdxBlocks } from '@/lib/mdx-editing';
import { assertCompilableMdx } from '@/lib/server/mdx-validate';
import { writeContent } from '@/lib/storage/r2';
import { normalizeEditorImageMarkup } from '@/lib/utils/editor-image';

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

/**
 * Write a frontmatter+content MDX file to the content bucket, refusing content the site's MDX
 * compiler can't compile (InvalidMdxError) before anything is written.
 *
 * @param revision - Revision the editor loaded; null when creating a new file.
 * @returns The new revision.
 */
export const writeMdx = async (
  key: string,
  data: Record<string, unknown>,
  content: string,
  revision: string | null,
) => {
  const body = `${transformOutsideMdxBlocks(content, normalizeEditorImageMarkup).trimEnd()}\n`;
  await assertCompilableMdx(body);
  const file = matter.stringify(body, stripUndefinedValues(data) as Record<string, unknown>);
  return writeContent(key, file, revision, 'text/markdown; charset=utf-8');
};
