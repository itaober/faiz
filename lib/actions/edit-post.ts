'use server';

import { revalidatePath } from 'next/cache';

import { CONTENT_KEYS } from '@/lib/content-keys';
import { type PostList, PostListSchema, type PostMeta } from '@/lib/data/data';
import {
  removePost,
  replacePost,
  sortPosts,
  upsertPost,
  withCreatedDate,
} from '@/lib/data/posts-index';
import { formatTime } from '@/lib/dayjs';
import { StorageError } from '@/lib/errors';
import { requireEditSession } from '@/lib/server/edit-session';
import { normalizeOptionalString, writeMdx } from '@/lib/server/mdx-write';
import {
  deleteContent,
  readContentForUpdate,
  readContentJsonForUpdate,
  writeContentJson,
} from '@/lib/storage/r2';
import {
  type ActionError,
  type ActionResult,
  createActionError,
  notFoundError,
  validationError,
} from '@/lib/types/action-result';

interface IPostPayload {
  title: string;
  slug: string;
  tags: string[];
  pinned?: boolean;
  /** Day picked in the editor, `YYYY-MM-DD`. */
  createdDate?: string;
  content: string;
}

type ICreatePostInput = IPostPayload;

interface IUpdatePostInput extends IPostPayload {
  originalSlug: string;
  /** Revision the editor loaded, so a concurrent edit is rejected instead of overwritten. */
  revision?: string;
}

/** A save also returns the revision it produced, so the open editor can save again. */
export interface IPostSaveResult {
  post: PostMeta;
  revision: string;
}

interface IDeletePostInput {
  slug: string;
}

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

  if (
    input.createdDate &&
    (typeof input.createdDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.createdDate))
  ) {
    return validationError('Invalid date');
  }

  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    return validationError('Invalid tags');
  }

  return null;
};

/**
 * Reads the index with the revision it came from.
 *
 * A read failure propagates instead of being swallowed into an empty list:
 * treating "storage is down" as "there are no posts" combined with a blind
 * overwrite would replace the whole index with a single entry.
 */
const readPostList = async (): Promise<{ posts: PostList; revision: string | null }> => {
  const file = await readContentJsonForUpdate<unknown>(CONTENT_KEYS.postsIndex);
  return { posts: PostListSchema.parse(file?.data ?? []), revision: file?.revision ?? null };
};

/**
 * Applies one change to the index under an if-unchanged write.
 *
 * On a conflict the index moved between the read and the write, so re-read and replay
 * the mutation against the new list. Each mutation is a single add, replace or
 * remove keyed by slug, so replaying is safe; a second conflict gives up and
 * surfaces CONFLICT.
 */
const savePostsIndex = async (mutate: (posts: PostList) => PostList) => {
  for (let attempt = 0; ; attempt++) {
    const { posts, revision } = await readPostList();

    try {
      await writeContentJson(CONTENT_KEYS.postsIndex, sortPosts(mutate(posts)), revision);
      return;
    } catch (error) {
      const isConflict = error instanceof StorageError && error.status === 412;
      if (!isConflict || attempt > 0) {
        throw error;
      }
    }
  }
};

/**
 * Revision of a post file the index does not list, left by a save that failed before its index
 * write. Writing over it (archived first) lets that save be retried instead of conflicting forever.
 */
const unlistedRevision = async (slug: string) =>
  (await readContentForUpdate(CONTENT_KEYS.post(slug)))?.revision ?? null;

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
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  const invalid = validatePostPayload(input);
  if (invalid) {
    return invalid;
  }

  try {
    const slug = normalizeSlug(input.slug);
    const { posts } = await readPostList();
    if (posts.some(post => post.slug === slug)) {
      return validationError('Slug already exists');
    }

    const now = formatTime();
    const post: PostMeta = {
      slug,
      title: normalizeOptionalString(input.title),
      createdTime: withCreatedDate(now, input.createdDate),
      updatedTime: now,
      tags: normalizeTags(input.tags),
      pinned: input.pinned === true || undefined,
    };

    const written = await writeMdx(
      CONTENT_KEYS.post(slug),
      post,
      input.content,
      await unlistedRevision(slug),
    );
    await savePostsIndex(current => upsertPost(current, post));

    revalidatePosts(slug);
    return { success: true, data: { post, revision: written.revision } };
  } catch (error) {
    console.error('Failed to create post:', error);
    return createActionError(error, 'Failed to create post');
  }
}

export async function updatePostAction(
  input: IUpdatePostInput,
): Promise<ActionResult<IPostSaveResult>> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  const invalid = validatePostPayload(input);
  if (invalid) {
    return invalid;
  }

  try {
    const slug = normalizeSlug(input.slug);
    const originalSlug = normalizeSlug(input.originalSlug);
    const { posts } = await readPostList();
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
      createdTime: withCreatedDate(existingPost.createdTime, input.createdDate),
      updatedTime: formatTime(),
      tags: normalizeTags(input.tags),
      pinned: input.pinned === true || undefined,
    };

    const renamed = slug !== originalSlug;
    const revision = input.revision ?? null;
    // A rename creates the new path and drops the old one, so the loaded revision is checked
    // against the old file before anything is written; the old file goes last, so a failure on
    // the way leaves a spare copy rather than a post missing from the index.
    if (renamed) {
      const current = await readContentForUpdate(CONTENT_KEYS.post(originalSlug));
      if (current?.revision !== revision) {
        throw new StorageError(412, `Conflict renaming ${originalSlug}`);
      }
    }

    const written = await writeMdx(
      CONTENT_KEYS.post(slug),
      post,
      input.content,
      renamed ? await unlistedRevision(slug) : revision,
    );
    await savePostsIndex(current => replacePost(current, originalSlug, post));
    if (renamed) {
      await deleteContent(CONTENT_KEYS.post(originalSlug), revision ?? undefined);
    }

    revalidatePosts(slug, originalSlug);
    return { success: true, data: { post, revision: written.revision } };
  } catch (error) {
    console.error('Failed to update post:', error);
    return createActionError(error, 'Failed to update post');
  }
}

export async function deletePostAction(input: IDeletePostInput): Promise<ActionResult> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  try {
    const slug = normalizeSlug(input.slug);
    if (!slug) {
      return validationError('Slug is required');
    }

    const { posts } = await readPostList();
    if (!posts.some(post => post.slug === slug)) {
      return notFoundError('Post not found');
    }

    await deleteContent(CONTENT_KEYS.post(slug));
    await savePostsIndex(current => removePost(current, slug));

    revalidatePosts(slug);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete post:', error);
    return createActionError(error, 'Failed to delete post');
  }
}
