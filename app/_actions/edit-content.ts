'use server';

import matter from 'gray-matter';
import { revalidatePath } from 'next/cache';

import { isEditablePage, isRecordType } from '@/lib/content-editing-validation';
import {
  deleteGitHubFile,
  fetchGitHubJson,
  fetchGitHubText,
  putGitHubFile,
  writeGitHubJson,
} from '@/lib/data/common';
import {
  type PostList,
  PostListSchema,
  type PostMeta,
  type RecordItem,
  type Records,
  RecordsSchema,
} from '@/lib/data/data';
import dayjs, { formatTime } from '@/lib/dayjs';
import { requireAuth } from '@/lib/server/content-edit-token';
import { type ActionError, type ActionResult, createActionError } from '@/lib/types/action-result';
import { normalizeEditorImageMarkup } from '@/lib/utils/editor-image';

const POSTS_INDEX_PATH = 'data/posts.json';
const RECORDS_PATH = 'data/records.json';
const POST_CONTENT_DIR = 'data/posts';
const PAGE_PATHS = {
  about: 'pages/about.mdx',
  lines: 'pages/lines.mdx',
} as const;

type EditablePage = keyof typeof PAGE_PATHS;

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

interface IUpdatePageInput {
  page: EditablePage;
  title: string;
  content: string;
  token: string;
}

interface IRecordKey {
  title: string;
  type: RecordItem['type'];
  createdTime: string;
}

interface IRecordInput {
  record: RecordItem;
  token: string;
}

interface IUpdateRecordInput extends IRecordInput {
  original: IRecordKey;
}

interface IDeleteRecordInput {
  original: IRecordKey;
  token: string;
}

const createMutationFetchInit = (): RequestInit => ({ cache: 'no-store' });

const createEmptyRecords = (): Records => ({
  book: [],
  movie: [],
  tv: [],
  music: [],
  game: [],
});

const buildPostPath = (slug: string) => `${POST_CONTENT_DIR}/${slug}.mdx`;

const createValidationError = (error: string): ActionError => ({
  success: false,
  error,
  code: 'VALIDATION',
  retryable: false,
});

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

const normalizeOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : '';

const validatePostPayload = (input: IPostPayload): ActionError | null => {
  if (!normalizeOptionalString(input.title)) {
    return createValidationError('Title is required');
  }

  if (!normalizeSlug(input.slug)) {
    return createValidationError('Slug is required');
  }

  if (!normalizeOptionalString(input.content)) {
    return createValidationError('Content is required');
  }

  if (input.tags !== undefined && !Array.isArray(input.tags)) {
    return createValidationError('Invalid tags');
  }

  return null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]';

const stripUndefinedValues = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedValues).filter(item => item !== undefined);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => {
        const cleaned = stripUndefinedValues(item);
        return cleaned === undefined ? [] : [[key, cleaned]];
      }),
    );
  }

  return value;
};

const stringifyMdx = (data: Record<string, unknown>, content: string) =>
  matter.stringify(
    `${normalizeEditorImageMarkup(content).trimEnd()}\n`,
    stripUndefinedValues(data) as Record<string, unknown>,
  );

const writeMdx = async (
  path: string,
  data: Record<string, unknown>,
  content: string,
  message: string,
  token: string,
) => {
  const mdx = stringifyMdx(data, content);
  await putGitHubFile(
    path,
    {
      contentBase64: Buffer.from(mdx, 'utf8').toString('base64'),
      message,
    },
    token,
  );
};

const fetchPostList = async (token: string): Promise<PostList> => {
  const raw = await fetchGitHubJson<unknown>(
    POSTS_INDEX_PATH,
    createMutationFetchInit(),
    token,
  ).catch(() => []);
  return PostListSchema.parse(raw ?? []);
};

const fetchRecords = async (token: string): Promise<Records> => {
  const raw = await fetchGitHubJson<unknown>(RECORDS_PATH, createMutationFetchInit(), token).catch(
    () => createEmptyRecords(),
  );
  return RecordsSchema.parse({ ...createEmptyRecords(), ...(raw ?? {}) });
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

const sortRecordList = (records: RecordItem[]) =>
  [...records].sort((a, b) => dayjs(b.createdTime).diff(dayjs(a.createdTime)));

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

  const validationError = validatePostPayload(input);
  if (validationError) {
    return validationError;
  }

  try {
    const slug = normalizeSlug(input.slug);
    const posts = await fetchPostList(token);
    if (posts.some(post => post.slug === slug)) {
      return {
        success: false,
        error: 'Slug already exists',
        code: 'VALIDATION',
        retryable: false,
      };
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

  const validationError = validatePostPayload(input);
  if (validationError) {
    return validationError;
  }

  try {
    const slug = normalizeSlug(input.slug);
    const originalSlug = normalizeSlug(input.originalSlug);
    const posts = await fetchPostList(token);
    const existingPost = posts.find(post => post.slug === originalSlug);

    if (!existingPost) {
      return {
        success: false,
        error: 'Post not found',
        code: 'NOT_FOUND',
        retryable: false,
      };
    }

    if (slug !== originalSlug && posts.some(post => post.slug === slug)) {
      return {
        success: false,
        error: 'Slug already exists',
        code: 'VALIDATION',
        retryable: false,
      };
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
      return createValidationError('Slug is required');
    }

    const posts = await fetchPostList(token);
    const nextPosts = posts.filter(post => post.slug !== slug);

    if (nextPosts.length === posts.length) {
      return {
        success: false,
        error: 'Post not found',
        code: 'NOT_FOUND',
        retryable: false,
      };
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

export async function updatePageAction(input: IUpdatePageInput): Promise<ActionResult> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!normalizeOptionalString(input.title)) {
    return createValidationError('Title is required');
  }

  if (typeof input.content !== 'string') {
    return createValidationError('Content is required');
  }

  if (!isEditablePage(input.page)) {
    return createValidationError('Invalid editable page');
  }

  try {
    const path = PAGE_PATHS[input.page];
    const raw = await fetchGitHubText(path, createMutationFetchInit(), token).catch(() => '');
    const parsed = matter(raw);
    const now = formatTime();
    const data = {
      slug: input.page,
      createdTime: parsed.data.createdTime || now,
      tags: parsed.data.tags || [],
      ...parsed.data,
      title: normalizeOptionalString(input.title),
      updatedTime: now,
    };

    await writeMdx(path, data, input.content, `docs: update ${path}`, token);

    revalidatePath(input.page === 'about' ? '/' : `/${input.page}`);
    if (input.page === 'about') {
      revalidatePath('/about');
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to update page:', error);
    return createActionError(error, 'Failed to update page');
  }
}

const validateRecordKey = (key: IRecordKey): ActionError | null => {
  if (!key?.title?.trim()) {
    return createValidationError('Record title is required');
  }

  if (!key?.createdTime?.trim()) {
    return createValidationError('Record createdTime is required');
  }

  if (!isRecordType(key?.type)) {
    return createValidationError('Invalid record type');
  }

  return null;
};

const findRecord = (records: Records, key: IRecordKey) => {
  if (!isRecordType(key.type)) {
    return undefined;
  }

  return records[key.type].find(
    record => record.title === key.title && record.createdTime === key.createdTime,
  );
};

const removeRecord = (records: Records, key: IRecordKey): Records => ({
  ...records,
  ...(isRecordType(key.type)
    ? {
        [key.type]: records[key.type].filter(
          record => !(record.title === key.title && record.createdTime === key.createdTime),
        ),
      }
    : {}),
});

const normalizeRecord = (record: RecordItem): RecordItem | ActionError => {
  if (!isRecordType(record?.type)) {
    return createValidationError('Invalid record type');
  }

  return {
    title: typeof record.title === 'string' ? record.title.trim() : '',
    link: typeof record.link === 'string' ? record.link.trim() : '',
    coverUrl: typeof record.coverUrl === 'string' ? record.coverUrl.trim() : '',
    createdTime:
      typeof record.createdTime === 'string' && record.createdTime.trim()
        ? record.createdTime.trim()
        : formatTime(),
    rating: typeof record.rating === 'number' && record.rating > 0 ? record.rating : undefined,
    comment: typeof record.comment === 'string' ? record.comment.trim() || undefined : undefined,
    type: record.type,
  };
};

const writeRecords = async (records: Records, token: string) => {
  const sorted: Records = {
    book: sortRecordList(records.book),
    movie: sortRecordList(records.movie),
    tv: sortRecordList(records.tv),
    music: sortRecordList(records.music),
    game: sortRecordList(records.game),
  };

  await writeGitHubJson(RECORDS_PATH, sorted, `docs: update ${RECORDS_PATH}`, token);
  revalidatePath('/records');
};

export async function createRecordAction(input: IRecordInput): Promise<ActionResult<RecordItem>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return createValidationError('Title, link, and cover are required');
    }

    const records = await fetchRecords(token);
    await writeRecords(
      {
        ...records,
        [record.type]: [record, ...records[record.type]],
      },
      token,
    );

    return { success: true, data: record };
  } catch (error) {
    console.error('Failed to create record:', error);
    return createActionError(error, 'Failed to create record');
  }
}

export async function updateRecordAction(
  input: IUpdateRecordInput,
): Promise<ActionResult<RecordItem>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const originalValidationError = validateRecordKey(input.original);
    if (originalValidationError) {
      return originalValidationError;
    }

    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return createValidationError('Title, link, and cover are required');
    }

    const records = await fetchRecords(token);
    const existing = findRecord(records, input.original);

    if (!existing) {
      return {
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
        retryable: false,
      };
    }

    const withoutOriginal = removeRecord(records, input.original);
    withoutOriginal[record.type] = [record, ...withoutOriginal[record.type]];
    await writeRecords(withoutOriginal, token);

    return { success: true, data: record };
  } catch (error) {
    console.error('Failed to update record:', error);
    return createActionError(error, 'Failed to update record');
  }
}

export async function deleteRecordAction(input: IDeleteRecordInput): Promise<ActionResult> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const originalValidationError = validateRecordKey(input.original);
    if (originalValidationError) {
      return originalValidationError;
    }

    const records = await fetchRecords(token);
    const existing = findRecord(records, input.original);

    if (!existing) {
      return {
        success: false,
        error: 'Record not found',
        code: 'NOT_FOUND',
        retryable: false,
      };
    }

    await writeRecords(removeRecord(records, input.original), token);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete record:', error);
    return createActionError(error, 'Failed to delete record');
  }
}
