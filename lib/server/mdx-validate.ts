import { serialize } from 'next-mdx-remote/serialize';

// Relative + explicit extension so tests/ can import this under bare Node.
import { InvalidMdxError } from '../errors.ts';
import { mdxErrorLine, parseMdx } from '../mdx-editing.ts';

const leftOpen = (error: unknown) => (error as { ruleId?: unknown }).ruleId === 'unexpected-eof';

/**
 * The line an error starts at. micromark reports a `{` or tag left open at the end of the file,
 * so for that the line is the first one past the longest leading part that doesn't leave one
 * open (it may still fail otherwise: cut inside a component, it misses the closing tag).
 */
const errorLine = (content: string, error: unknown) => {
  if (!leftOpen(error)) return mdxErrorLine(error);
  const lines = content.split('\n');
  for (let count = lines.length - 1; count > 0; count -= 1) {
    try {
      parseMdx(lines.slice(0, count).join('\n'));
    } catch (prefixError) {
      if (leftOpen(prefixError)) continue;
    }
    return count + 1;
  }
  return 1;
};

/**
 * Refuses content the site's MDX compiler can't compile, so a save never breaks the page that
 * shows it. The editor's parser names the failing line; the compiler, with the read view's
 * options, then catches what only reading `{…}` as JavaScript reveals.
 */
export const assertCompilableMdx = async (content: string) => {
  try {
    parseMdx(content);
  } catch (error) {
    throw new InvalidMdxError(errorLine(content, error));
  }
  try {
    await serialize(content, { blockJS: false, blockDangerousJS: true });
  } catch {
    throw new InvalidMdxError();
  }
};
