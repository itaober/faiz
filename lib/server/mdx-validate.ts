import { serialize } from 'next-mdx-remote/serialize';

// Relative + explicit extension so tests/ can import this under bare Node.
import { InvalidMdxError } from '../errors.ts';
import { mdxErrorLine, parseMdx } from '../mdx-editing.ts';
import { toRenderableMdx } from '../utils/editor-image.ts';

const parseError = (source: string) => {
  try {
    parseMdx(source);
    return undefined;
  } catch (error) {
    return error as { ruleId?: unknown; source?: unknown; place?: { offset?: unknown } };
  }
};

/**
 * The line `source` stops being valid MDX on, for the refusal to quote: the compiler's error
 * has lost its position, so the parser is asked. It reports a `{` or tag left open at the end
 * of the file; the line opening it is found by bisecting the lines that could. A tag left open
 * before more text runs on past a blank line, which a real tag never holds, and fails on that
 * text; the line opening the tag is quoted instead.
 */
const failingLine = (source: string) => {
  const error = parseError(source);
  if (!error) return undefined;
  const lines = source.split('\n');
  const line = mdxErrorLine(error);
  if (error.ruleId !== 'unexpected-eof' || line !== lines.length) {
    const offset = error.place?.offset;
    if (error.source === 'micromark-extension-mdx-jsx' && typeof offset === 'number') {
      const tag = source.lastIndexOf('<', offset - 1);
      if (tag >= 0 && /\n[ \t]*\n/.test(source.slice(tag, offset))) {
        return lines[source.slice(0, tag).split('\n').length - 1];
      }
    }
    return line ? lines[line - 1] : undefined;
  }
  const openers = lines.flatMap((text, index) => (/^ {0,3}[<{]/.test(text) ? [index] : []));
  let low = 0;
  let high = openers.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    const before = parseError(lines.slice(0, openers[mid]).join('\n'));
    if (before?.ruleId === 'unexpected-eof') high = mid;
    else low = mid + 1;
  }
  return lines[openers[low - 1] ?? line - 1];
};

/**
 * Refuses content the read view can't compile, so a save never breaks the page that shows it:
 * the text is prepared as that view prepares it and compiled with its options.
 */
export const assertCompilableMdx = async (content: string) => {
  const source = toRenderableMdx(content);
  try {
    await serialize(source, { blockJS: false, blockDangerousJS: true });
  } catch {
    const near = Array.from(failingLine(source)?.trim() ?? '');
    throw new InvalidMdxError(
      near.length > 40 ? `${near.slice(0, 40).join('')}…` : near.join('') || undefined,
    );
  }
};
