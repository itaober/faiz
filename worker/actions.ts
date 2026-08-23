import matter from 'gray-matter';
import {
  EDITABLE_PAGE_PATHS,
  type EditablePage,
  isEditablePage,
  isRecordType,
  MAX_MEMO_CONTENT_LENGTH,
  normalizeImagePathList,
} from '@/lib/content-editing-validation';
import {
  deleteGitHubFile,
  fetchGitHubFileWithSha,
  fetchGitHubJsonWithSha,
  fetchGitHubText,
  writeGitHubJson,
} from '@/lib/data/github';
import { uploadImage } from '@/lib/data/images';
import type { Memo } from '@/lib/data/memos-shared';
import { deleteMemoWithImages, prependMemo, updateMemoWithImages } from '@/lib/data/memos-write';
import { removePost, replacePost, sortPosts, upsertPost } from '@/lib/data/posts-index';
import {
  type PostList,
  PostListSchema,
  type PostMeta,
  type RecordItem,
  type Records,
  RecordsSchema,
} from '@/lib/data/schemas';
import dayjs, { formatTime } from '@/lib/dayjs';
import { GitHubApiError } from '@/lib/errors';
import { createMutationFetchInit, normalizeOptionalString, writeMdx } from '@/lib/server/mdx-write';
import {
  type ActionError,
  type ActionResult,
  createActionError,
  notFoundError,
  validationError,
} from '@/lib/types/action-result';
import {
  buildEditorImageStoragePath,
  type EditorImageScope,
  generateEditorImageId,
} from '@/lib/utils/editor-image';

import { requireAuth } from './auth';

// The former server actions, moved verbatim minus Next-specific pieces
// (`'use server'`, revalidatePath/updateTag): the static site has nothing to
// invalidate — publishing happens through the rebuild a content push triggers.

// ================================
// Posts
// ================================

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

export interface ICreatePostInput extends IPostPayload {
  token: string;
}

export interface IUpdatePostInput extends IPostPayload {
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

export interface IDeletePostInput {
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

export async function createPostAction(
  input: ICreatePostInput,
): Promise<ActionResult<IPostSaveResult>> {
  const token = requireAuth(input.token);
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

    return { success: true, data: { post, contentSha: written.sha } };
  } catch (error) {
    console.error('Failed to create post:', error);
    return createActionError(error, 'Failed to create post');
  }
}

export async function updatePostAction(
  input: IUpdatePostInput,
): Promise<ActionResult<IPostSaveResult>> {
  const token = requireAuth(input.token);
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

    return { success: true, data: { post, contentSha: written.sha } };
  } catch (error) {
    console.error('Failed to update post:', error);
    return createActionError(error, 'Failed to update post');
  }
}

export async function deletePostAction(input: IDeletePostInput): Promise<ActionResult> {
  const token = requireAuth(input.token);
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

    return { success: true };
  } catch (error) {
    console.error('Failed to delete post:', error);
    return createActionError(error, 'Failed to delete post');
  }
}

// ================================
// Pages (about / lines)
// ================================

export interface IUpdatePageInput {
  page: EditablePage;
  title: string;
  content: string;
  token: string;
  /** Revision the editor loaded, so a concurrent edit is rejected instead of overwritten. */
  sha?: string;
}

/** A save returns the revision it produced, so the open editor can save again. */
export interface IPageSaveResult {
  contentSha?: string;
}

export async function updatePageAction(
  input: IUpdatePageInput,
): Promise<ActionResult<IPageSaveResult>> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!normalizeOptionalString(input.title)) {
    return validationError('Title is required');
  }

  if (typeof input.content !== 'string') {
    return validationError('Content is required');
  }

  if (!isEditablePage(input.page)) {
    return validationError('Invalid editable page');
  }

  try {
    const path = EDITABLE_PAGE_PATHS[input.page];
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

    const written = await writeMdx(
      path,
      data,
      input.content,
      `docs: update ${path}`,
      token,
      input.sha,
    );

    return { success: true, data: { contentSha: written.sha } };
  } catch (error) {
    console.error('Failed to update page:', error);
    return createActionError(error, 'Failed to update page');
  }
}

// ================================
// Records
// ================================

const RECORDS_PATH = 'data/records.json';

interface IRecordKey {
  title: string;
  type: RecordItem['type'];
  createdTime: string;
}

export interface IRecordInput {
  record: RecordItem;
  token: string;
}

export interface IUpdateRecordInput extends IRecordInput {
  original: IRecordKey;
}

export interface IDeleteRecordInput {
  original: IRecordKey;
  token: string;
}

const createEmptyRecords = (): Records => ({
  book: [],
  movie: [],
  tv: [],
  music: [],
  game: [],
});

/**
 * Reads records with the revision they came from. A read failure propagates
 * rather than being read as "no records", which combined with a blind overwrite
 * would have replaced the whole file.
 */
const fetchRecordsWithSha = async (token: string): Promise<{ records: Records; sha?: string }> => {
  const file = await fetchGitHubJsonWithSha<unknown>(RECORDS_PATH, token);
  return {
    records: RecordsSchema.parse({ ...createEmptyRecords(), ...(file?.data ?? {}) }),
    sha: file?.sha,
  };
};

const sortRecordList = (records: RecordItem[]) =>
  [...records].sort((a, b) => dayjs(b.createdTime).diff(dayjs(a.createdTime)));

const validateRecordKey = (key: IRecordKey): ActionError | null => {
  if (!key?.title?.trim()) {
    return validationError('Record title is required');
  }

  if (!key?.createdTime?.trim()) {
    return validationError('Record createdTime is required');
  }

  if (!isRecordType(key?.type)) {
    return validationError('Invalid record type');
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
    return validationError('Invalid record type');
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

// No retry-on-conflict here, unlike the posts index: this rewrites the whole
// records file, so replaying a stale in-memory copy would drop the other edit.
const writeRecords = async (records: Records, token: string, sha?: string) => {
  const sorted: Records = {
    book: sortRecordList(records.book),
    movie: sortRecordList(records.movie),
    tv: sortRecordList(records.tv),
    music: sortRecordList(records.music),
    game: sortRecordList(records.game),
  };

  await writeGitHubJson(RECORDS_PATH, sorted, `docs: update ${RECORDS_PATH}`, token, sha);
};

export async function createRecordAction(input: IRecordInput): Promise<ActionResult<RecordItem>> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return validationError('Title, link, and cover are required');
    }

    const { records, sha } = await fetchRecordsWithSha(token);
    await writeRecords(
      {
        ...records,
        [record.type]: [record, ...records[record.type]],
      },
      token,
      sha,
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
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const invalid = validateRecordKey(input.original);
    if (invalid) {
      return invalid;
    }

    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return validationError('Title, link, and cover are required');
    }

    const { records, sha } = await fetchRecordsWithSha(token);
    const existing = findRecord(records, input.original);

    if (!existing) {
      return notFoundError('Record not found');
    }

    const withoutOriginal = removeRecord(records, input.original);
    withoutOriginal[record.type] = [record, ...withoutOriginal[record.type]];
    await writeRecords(withoutOriginal, token, sha);

    return { success: true, data: record };
  } catch (error) {
    console.error('Failed to update record:', error);
    return createActionError(error, 'Failed to update record');
  }
}

export async function deleteRecordAction(input: IDeleteRecordInput): Promise<ActionResult> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const invalid = validateRecordKey(input.original);
    if (invalid) {
      return invalid;
    }

    const { records, sha } = await fetchRecordsWithSha(token);
    const existing = findRecord(records, input.original);

    if (!existing) {
      return notFoundError('Record not found');
    }

    await writeRecords(removeRecord(records, input.original), token, sha);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete record:', error);
    return createActionError(error, 'Failed to delete record');
  }
}

// ================================
// Memos
// ================================

export interface ICreateMemoInput {
  id: string;
  content: string;
  images?: string[];
  token: string;
}

export async function createMemoAction(input: ICreateMemoInput): Promise<ActionResult<Memo>> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  const content = typeof input.content === 'string' ? input.content : '';
  const normalizedImages = normalizeImagePathList(input.images ?? [], 'memos');
  if (normalizedImages.invalid.length > 0) {
    return validationError('Invalid memo image path');
  }

  // Allow memos with only images
  if (!content.trim() && normalizedImages.paths.length === 0) {
    return validationError('Content or images cannot be empty');
  }

  if (content.length > MAX_MEMO_CONTENT_LENGTH) {
    return validationError(`Content too long (max ${MAX_MEMO_CONTENT_LENGTH} characters)`);
  }

  try {
    const memo = await prependMemo({
      id: input.id,
      content: content.trim(),
      images: normalizedImages.paths,
      token,
    });

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to create memo:', error);
    return createActionError(error, 'Failed to create memo');
  }
}

export interface IUpdateMemoInput {
  id: string;
  content: string;
  images?: string[];
  createdTime: string;
  token: string;
}

export async function updateMemoAction(input: IUpdateMemoInput): Promise<ActionResult<Memo>> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  const content = typeof input.content === 'string' ? input.content : '';
  const normalizedImages =
    input.images === undefined ? null : normalizeImagePathList(input.images, 'memos');

  if (normalizedImages && normalizedImages.invalid.length > 0) {
    return validationError('Invalid memo image path');
  }

  if (!input.id?.trim()) {
    return validationError('Memo ID is required');
  }

  if (!input.createdTime?.trim()) {
    return validationError('Memo createdTime is required');
  }

  if (!content.trim() && (!normalizedImages || normalizedImages.paths.length === 0)) {
    return validationError('Content or images cannot be empty');
  }

  if (content.length > MAX_MEMO_CONTENT_LENGTH) {
    return validationError(`Content too long (max ${MAX_MEMO_CONTENT_LENGTH} characters)`);
  }

  try {
    const { memo } = await updateMemoWithImages({
      id: input.id,
      content: content.trim(),
      images: normalizedImages?.paths,
      createdTime: input.createdTime,
      token,
    });

    return { success: true, data: memo };
  } catch (error) {
    console.error('Failed to update memo:', error);
    return createActionError(error, 'Failed to update memo');
  }
}

export interface IDeleteMemoInput {
  id: string;
  createdTime: string;
  token: string;
}

export async function deleteMemoAction(input: IDeleteMemoInput): Promise<ActionResult> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!input.id?.trim()) {
    return validationError('Memo ID is required');
  }

  if (!input.createdTime?.trim()) {
    return validationError('Memo createdTime is required');
  }

  try {
    await deleteMemoWithImages({
      id: input.id,
      createdTime: input.createdTime,
      token,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete memo:', error);
    return createActionError(error, 'Failed to delete memo');
  }
}

// ================================
// Editor image upload
// ================================

const ALLOWED_SCOPES = ['memos', 'posts', 'pages', 'records'] as const;

export interface IUploadEditorImageInput {
  imageBase64: string;
  mimeType: string;
  scope: EditorImageScope;
  entityId: string;
  token: string;
  imageId?: string;
}

const isAllowedScope = (scope: string): scope is EditorImageScope =>
  ALLOWED_SCOPES.includes(scope as EditorImageScope);

export async function uploadEditorImageAction(
  input: IUploadEditorImageInput,
): Promise<ActionResult<string>> {
  const token = requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!isAllowedScope(input.scope)) {
    return validationError('Invalid image scope');
  }

  try {
    const storagePath = buildEditorImageStoragePath({
      entityId: input.entityId,
      imageId: input.imageId || generateEditorImageId(),
      scope: input.scope,
    });

    const result = await uploadImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      storagePath,
      token,
    });

    return { success: true, data: result.path };
  } catch (error) {
    console.error('Failed to upload editor image:', error);
    return createActionError(error, 'Failed to upload image');
  }
}

// ================================
// Editable content loader
// ================================

export type EditableContentTarget =
  | { kind: 'post'; slug: string }
  | { kind: 'page'; page: EditablePage };

export interface EditableContent {
  content: string;
  /** Blob SHA of the revision that was loaded, so a save can detect a conflict. */
  sha: string;
}

const POST_SLUG_PATTERN = /^[a-z0-9-]+$/;

const resolvePath = (target: EditableContentTarget) => {
  if (target.kind === 'page') {
    return isEditablePage(target.page) ? EDITABLE_PAGE_PATHS[target.page] : null;
  }

  return POST_SLUG_PATTERN.test(target.slug) ? `data/posts/${target.slug}.mdx` : null;
};

/**
 * Loads the raw MDX body for an editor. Pages ship only their rendered output,
 * so the source is fetched when someone actually opens the editor rather than
 * riding along in every visitor's payload.
 *
 * Unauthenticated on purpose — this returns content that is already public.
 * When the edit cookie is present its token is used for the read, which keeps
 * the request inside the token's rate limit instead of the anonymous one shared
 * by the whole Cloudflare egress IP.
 */
export async function loadEditableContentAction(
  target: EditableContentTarget & { token?: string },
): Promise<ActionResult<EditableContent>> {
  const path = resolvePath(target);
  if (!path) {
    return validationError('Invalid content target');
  }

  try {
    const file = await fetchGitHubFileWithSha(path, target.token?.trim() || undefined);
    if (!file) {
      return notFoundError('Content not found');
    }

    return { success: true, data: { content: matter(file.text).content, sha: file.sha } };
  } catch (error) {
    console.error('Failed to load editable content:', path, error);
    return createActionError(error, 'Failed to load content');
  }
}
