'use server';

import { revalidatePath } from 'next/cache';

import { deleteGitHubFile, fetchGitHubJson, writeGitHubJson } from '@/lib/data/common';
import { type PostList, PostListSchema, type PostMeta } from '@/lib/data/data';
import dayjs, { formatTime } from '@/lib/dayjs';
import { requireAuth } from '@/lib/server/content-edit-token';
import { createMutationFetchInit, normalizeOptionalString, writeMdx } from '@/lib/server/mdx-write';
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

const fetchPostList = async (token: string): Promise<PostList> => {
  const raw = await fetchGitHubJson<unknown>(
    POSTS_INDEX_PATH,
    createMutationFetchInit(),
    token,
  ).catch(() => []);
  return PostListSchema.parse(raw ?? []);
};

const sortPosts = (posts: PostList) =>
  [...posts].sort((a, b) => {
    if (a.pinned && !b.pinned) {
      return -1;
    }
    if (!a.pinned && b.pinned) {
      return 1;
    }
    return dayjs(b.createdTime).diff(dayjs(a.createdTime));
  });

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

export async function createPostAction(input: ICreatePostInput): Promise<ActionResult<PostMeta>> {
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
    const posts = await fetchPostList(token);
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

    await writeMdx(buildPostPath(slug), post, input.content, `docs: add post ${slug}`, token);
    await writeGitHubJson(
      POSTS_INDEX_PATH,
      sortPosts([post, ...posts]),
      `docs: update ${POSTS_INDEX_PATH}`,
      token,
    );

    revalidatePosts(slug);
    return { success: true, data: post };
  } catch (error) {
    console.error('Failed to create post:', error);
    return createActionError(error, 'Failed to create post');
  }
}

export async function updatePostAction(input: IUpdatePostInput): Promise<ActionResult<PostMeta>> {
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
    const posts = await fetchPostList(token);
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

    await writeMdx(buildPostPath(slug), post, input.content, `docs: update post ${slug}`, token);

    if (slug !== originalSlug) {
      await deleteGitHubFile(
        buildPostPath(originalSlug),
        `docs: delete post ${originalSlug}`,
        token,
      );
    }

    const nextPosts = posts.map(item => (item.slug === originalSlug ? post : item));
    await writeGitHubJson(
      POSTS_INDEX_PATH,
      sortPosts(nextPosts),
      `docs: update ${POSTS_INDEX_PATH}`,
      token,
    );

    revalidatePosts(slug, originalSlug);
    return { success: true, data: post };
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

    const posts = await fetchPostList(token);
    const nextPosts = posts.filter(post => post.slug !== slug);

    if (nextPosts.length === posts.length) {
      return notFoundError('Post not found');
    }

    await deleteGitHubFile(buildPostPath(slug), `docs: delete post ${slug}`, token);
    await writeGitHubJson(
      POSTS_INDEX_PATH,
      sortPosts(nextPosts),
      `docs: update ${POSTS_INDEX_PATH}`,
      token,
    );

    revalidatePosts(slug);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete post:', error);
    return createActionError(error, 'Failed to delete post');
  }
}
