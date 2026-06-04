import { getRecordsInfo, type RecordType } from '@/lib/data/data';
import { getAboutMDX, getLinesMDX, getPostList } from '@/lib/data/mdx';
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
  const [posts, memos, records, about, lines] = await Promise.all([
    getPostList(),
    getMemosByMonths(months), // ALL months (not getMemos()'s recent-2-month window)
    getRecordsInfo(),
    getAboutMDX(),
    getLinesMDX(),
  ]);

  const docs: SearchDoc[] = [];

  for (const post of posts ?? []) {
    docs.push({
      id: `post:${post.data.slug}`,
      type: 'post',
      title: post.data.title,
      text: toSearchText(post.content),
      url: `/posts/${post.data.slug}`,
      tags: post.data.tags,
      date: post.data.createdTime,
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
