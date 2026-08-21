import { getPostListInfo, getRecordsInfo, type RecordType } from '@/lib/data/data';
import { getAboutMDX, getLinesMDX, getPostMDX } from '@/lib/data/mdx';
import { getMemosByMonths, getMemosIndex } from '@/lib/data/memos';
import { mdxTodoListsToMarkdown } from '@/lib/mdx-editing';
import { mdxImagesToMarkdown } from '@/lib/utils/editor-image';

import type { SearchDoc } from './types';

const RECORD_TYPES: RecordType[] = ['book', 'movie', 'tv', 'music', 'game'];

/**
 * Markdown/MDX → plain text for indexing. Reuses the editor converters so
 * checkbox/TodoList labels, image alts and inline <Link> text are surfaced
 * (rather than dropped) before stripping the remaining markup.
 */
const toSearchText = (markdown?: string) => {
  const md = mdxImagesToMarkdown(mdxTodoListsToMarkdown(markdown ?? ''));
  return md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`[^`]*`/g, ' ') // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // image → alt
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // link → text
    .replace(/<[^>]+>/g, ' ') // residual tags
    .replace(/(?:^|\n)[ \t]*[-*+][ \t]+(?:\[[ xX]\][ \t]*)?/g, ' ') // list / task markers
    .replace(/[>#*_~`|]+/g, ' ') // markdown punctuation
    .replace(/\s+/g, ' ')
    .trim();
};

/** Aggregate every searchable surface into flat plain-text docs. */
export async function buildSearchDocs(): Promise<SearchDoc[]> {
  const months = await getMemosIndex();
  const [postMetas, memos, records, about, lines] = await Promise.all([
    getPostListInfo(),
    getMemosByMonths(months), // ALL months (not getMemos()'s recent-2-month window)
    getRecordsInfo(),
    getAboutMDX(),
    getLinesMDX(),
  ]);

  const docs: SearchDoc[] = [];

  // Metadata comes from the index; only the body needs the .mdx file, and each
  // one is a separately cached fetch.
  const posts = await Promise.all(
    (postMetas ?? []).map(async meta => ({ meta, mdx: await getPostMDX(meta.slug) })),
  );

  for (const { meta, mdx } of posts) {
    if (!mdx) {
      continue;
    }

    docs.push({
      id: `post:${meta.slug}`,
      type: 'post',
      title: meta.title,
      text: toSearchText(mdx.content),
      url: `/posts/${meta.slug}`,
      tags: meta.tags,
      date: meta.createdTime,
    });
  }

  for (const memo of memos ?? []) {
    docs.push({
      id: `memo:${memo.id}`,
      type: 'memo',
      title: '',
      text: toSearchText(memo.content),
      url: `/memos/${memo.id}`,
      date: memo.createdTime,
    });
  }

  for (const type of RECORD_TYPES) {
    for (const record of records?.[type] ?? []) {
      docs.push({
        id: `record:${type}:${record.createdTime}:${record.title}`,
        type: 'record',
        title: record.title,
        text: toSearchText(record.comment),
        url: `/records?tab=${type}`,
        tags: [type],
        date: record.createdTime,
        rating: record.rating,
      });
    }
  }

  if (about) {
    docs.push({
      id: 'page:about',
      type: 'page',
      title: about.data.title || 'About',
      text: toSearchText(about.content),
      url: '/about',
    });
  }
  if (lines) {
    docs.push({
      id: 'page:lines',
      type: 'page',
      title: lines.data.title || 'Lines',
      text: toSearchText(lines.content),
      url: '/lines',
    });
  }

  return docs;
}
