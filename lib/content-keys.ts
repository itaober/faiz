/**
 * Where each piece of content lives in the content bucket. One place, so the layout is a single
 * decision rather than string literals spread across readers and writers.
 */
export const CONTENT_KEYS = {
  site: 'site.json',
  records: 'records.json',
  /** Generated on every post save from the posts' frontmatter; rebuildable at any time. */
  postsIndex: 'posts/_index.json',
  post: (slug: string) => `posts/${slug}.mdx`,
  page: (page: string) => `pages/${page}.mdx`,
  memosFolder: 'memos/',
  /** Memos are sharded by month; `month` is `YYYYMM`. */
  memos: (month: string) => `memos/${month.slice(0, 4)}-${month.slice(4)}.json`,
} as const;

/** `memos/2026-11.json` → `202611`; null for anything else in the folder. */
export const memoMonthFromKey = (key: string) =>
  key
    .match(/^memos\/(\d{4})-(\d{2})\.json$/)
    ?.slice(1)
    .join('') ?? null;
