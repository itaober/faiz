import { serialize } from 'next-mdx-remote/serialize';

// Relative + explicit extension so tests/ can import this under bare Node.
import { InvalidMdxError } from '../errors.ts';
import { mdxErrorLine, parseMdx } from '../mdx-editing.ts';

/**
 * Refuses content the site's MDX compiler can't compile, so a save never breaks the page that
 * shows it. The editor's parser names the failing line; the compiler, with the read view's
 * options, then catches what only reading `{…}` as JavaScript reveals.
 */
export const assertCompilableMdx = async (content: string) => {
  try {
    parseMdx(content);
  } catch (error) {
    throw new InvalidMdxError(mdxErrorLine(error));
  }
  try {
    await serialize(content, { blockJS: false, blockDangerousJS: true });
  } catch {
    throw new InvalidMdxError();
  }
};
