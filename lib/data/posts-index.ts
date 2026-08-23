import dayjs from 'dayjs';

import type { PostList, PostMeta } from './schemas.ts';

/** Pinned first, then newest by created time. */
export const sortPosts = (posts: PostList): PostList =>
  [...posts].sort((a, b) => {
    if (a.pinned && !b.pinned) {
      return -1;
    }
    if (!a.pinned && b.pinned) {
      return 1;
    }
    return dayjs(b.createdTime).diff(dayjs(a.createdTime));
  });

/*
 * These three describe one change to the index, and a write may be replayed on a
 * freshly read list after a 409. Each is therefore idempotent: applying it to a
 * list that already reflects the change leaves the list unchanged, so a replay
 * can never duplicate or resurrect an entry.
 */

export const upsertPost = (posts: PostList, post: PostMeta): PostList => [
  post,
  ...posts.filter(item => item.slug !== post.slug),
];

/** Replaces the entry at `originalSlug`, falling back to an upsert if a replay already moved it. */
export const replacePost = (posts: PostList, originalSlug: string, post: PostMeta): PostList =>
  posts.some(item => item.slug === originalSlug)
    ? posts.map(item => (item.slug === originalSlug ? post : item))
    : upsertPost(posts, post);

export const removePost = (posts: PostList, slug: string): PostList =>
  posts.filter(post => post.slug !== slug);
