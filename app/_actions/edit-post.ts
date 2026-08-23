'use server';

import { revalidatePath } from 'next/cache';

import { deleteGitHubFile, fetchGitHubJsonWithSha, writeGitHubJson } from '@/lib/data/common';
import { type PostList, PostListSchema, type PostMeta } from '@/lib/data/data';
import { removePost, replacePost, sortPosts, upsertPost } from '@/lib/data/posts-index';
import { formatTime } from '@/lib/dayjs';
import { GitHubApiError } from '@/lib/errors';
import { requireAuth } from '@/lib/server/content-edit-token';
import { normalizeOptionalString, writeMdx } from '@/lib/server/mdx-write';
import {
  type ActionError,
  type ActionResult,
  createActionError,
  notFoundError,
  validationError,
} from '@/lib/types/action-result';

const POSTS_INDEX_PATH = 'data/posts.json';
const POST_CONTENT_DIR = 'data/posts';

interface IPostPayload {
  title: string;
  slug: string;
  tags: string[];
  pinned?: boolean;
  createdTime?: string;
  content: string;
}

interface ICreatePostInput extends IPostPayload {
  token: string;
}

interface IUpdatePostInput extends IPostPayload {
  originalSlug: string;
  createdTime: string;
  token: string;
  /** Revision the editor loaded, so a concurrent edit is rejected instead of overwritten. */
  sha?: string;
}

/** A save also returns the revision it produced, so the open editor can save again. */
export interface IPostSaveResult {
  post: PostMeta;
  contentSha?: string;
}

interface IDeletePostInput {
  slug: string;
  token: string;
}

const buildPostPath = (slug: string) => `${POST_CONTENT_DIR}/${slug}.mdx`;

const normalizeTags = (tags: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(tags) ? tags : [])
        .filter((tag): tag is string => typeof tag === 'string')
        .map(tag => tag.trim())
        .filter(Boolean)
        .map(tag => tag.replace(/\s+/g, '-')),
    ),
  );

const normalizeSlug = (slug: unknown) =>
  typeof slug === 'string'
    ? slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    : '';

const validatePostPayload = (input: IPostPayload): ActionError | null => {
  if (!normalizeOptionalString(input.title)) {
    return validationError('Title is required');
  }

  if (!normalizeSlug(input.slug)) {
    return validationError('Slug is required');
  }

  if (!normalizeOptionalString(input.content)) {
    return validationError('Content is required');
  }

  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    return validationError('Invalid tags');
  }

  return null;
};

/**
 * Reads the index with the revision it came from.
 *
 * A read failure now propagates instead of being swallowed into an empty list:
 * treating "GitHub is down" as "there are no posts" combined with a blind
 * overwrite would have replaced the whole index with a single entry.
 */
const fetchPostListWithSha = async (token: string): Promise<{ posts: PostList; sha?: string }> => {
  const file = await fetchGitHubJsonWithSha<unknown>(POSTS_INDEX_PATH, token);
  return { posts: PostListSchema.parse(file?.data ?? []), sha: file?.sha };
};

/**
 * Applies one change to the index under an if-unchanged write.
 *
 * On 409 the index moved between the read and the write, so re-read and replay
 * the mutation against the new list. Each mutation is a single add, replace or
 * remove keyed by slug, so replaying is safe; a second conflict gives up and
 * surfaces CONFLICT.
 */
const savePostsIndex = async (token: string, mutate: (posts: PostList) => PostList) => {
  for (let attempt = 0; ; attempt++) {
    const { posts, sha } = await fetchPostListWithSha(token);

    try {
      await writeGitHubJson(
        POSTS_INDEX_PATH,
        sortPosts(mutate(posts)),
        `docs: update ${POSTS_INDEX_PATH}`,
        token,
        sha,
      );
      return;
    } catch (error) {
      const isConflict = error instanceof GitHubApiError && error.status === 409;
      if (!isConflict || attempt > 0) {
        throw error;
      }
    }
  }
};

const revalidatePosts = (slug?: string, previousSlug?: string) => {
  revalidatePath('/posts');
  if (slug) {
    revalidatePath(`/posts/${slug}`);
  }
  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/posts/${previousSlug}`);
  }
  revalidatePath('/feed.xml');
  revalidatePath('/sitemap.xml');
};

export async function createPostAction(
  input: ICreatePostInput,
): Promise<ActionResult<IPostSaveResult>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  const invalid = validatePostPayload(input);
  if (invalid) {
    return invalid;
  }

  try {
    const slug = normalizeSlug(input.slug);
    const { posts } = await fetchPostListWithSha(token);
    if (posts.some(post => post.slug === slug)) {
      return validationError('Slug already exists');
    }

    const now = formatTime();
    const post: PostMeta = {
      slug,
      title: normalizeOptionalString(input.title),
      createdTime: normalizeOptionalString(input.createdTime) || now,
      updatedTime: now,
      tags: normalizeTags(input.tags),
      pinned: input.pinned === true || undefined,
    };

    // New file, so no base revision to send.
    const written = await writeMdx(
      buildPostPath(slug),
      post,
      input.content,
      `docs: add post ${slug}`,
      token,
    );
    await savePostsIndex(token, current => upsertPost(current, post));

    revalidatePosts(slug);
    return { success: true, data: { post, contentSha: written.sha } };
  } catch (error) {
    console.error('Failed to create post:', error);
    return createActionError(error, 'Failed to create post');
  }
}

export async function updatePostAction(
  input: IUpdatePostInput,
): Promise<ActionResult<IPostSaveResult>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  const invalid = validatePostPayload(input);
  if (invalid) {
    return invalid;
  }

  try {
    const slug = normalizeSlug(input.slug);
    const originalSlug = normalizeSlug(input.originalSlug);
    const { posts } = await fetchPostListWithSha(token);
    const existingPost = posts.find(post => post.slug === originalSlug);

    if (!existingPost) {
      return notFoundError('Post not found');
    }

    if (slug !== originalSlug && posts.some(post => post.slug === slug)) {
      return validationError('Slug already exists');
    }

    const post: PostMeta = {
      slug,
      title: normalizeOptionalString(input.title),
      createdTime: normalizeOptionalString(input.createdTime) || existingPost.createdTime,
      updatedTime: formatTime(),
      tags: normalizeTags(input.tags),
      pinned: input.pinned === true || undefined,
    };

    // Renaming writes a new path, which is a create — the base revision only
    // applies when the slug is unchanged.
    const written = await writeMdx(
      buildPostPath(slug),
      post,
      input.content,
      `docs: update post ${slug}`,
      token,
      slug === originalSlug ? input.sha : undefined,
    );

    if (slug !== originalSlug) {
      await deleteGitHubFile(
        buildPostPath(originalSlug),
        `docs: delete post ${originalSlug}`,
        token,
      );
    }

    await savePostsIndex(token, current => replacePost(current, originalSlug, post));

    revalidatePosts(slug, originalSlug);
    return { success: true, data: { post, contentSha: written.sha } };
  } catch (error) {
    console.error('Failed to update post:', error);
    return createActionError(error, 'Failed to update post');
  }
}

export async function deletePostAction(input: IDeletePostInput): Promise<ActionResult> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const slug = normalizeSlug(input.slug);
    if (!slug) {
      return validationError('Slug is required');
    }

    const { posts } = await fetchPostListWithSha(token);
    if (!posts.some(post => post.slug === slug)) {
      return notFoundError('Post not found');
    }

    await deleteGitHubFile(buildPostPath(slug), `docs: delete post ${slug}`, token);
    await savePostsIndex(token, current => removePost(current, slug));

    revalidatePosts(slug);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete post:', error);
    return createActionError(error, 'Failed to delete post');
  }
}
