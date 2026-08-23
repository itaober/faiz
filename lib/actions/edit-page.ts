'use server';

import matter from 'gray-matter';
import { revalidatePath } from 'next/cache';

import {
  EDITABLE_PAGE_PATHS,
  type EditablePage,
  isEditablePage,
} from '@/lib/content-editing-validation';
import { fetchGitHubText } from '@/lib/data/github';
import { formatTime } from '@/lib/dayjs';
import { requireAuth } from '@/lib/server/content-edit-token';
import { createMutationFetchInit, normalizeOptionalString, writeMdx } from '@/lib/server/mdx-write';
import { type ActionResult, createActionError, validationError } from '@/lib/types/action-result';

interface IUpdatePageInput {
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
  const token = await requireAuth(input.token);
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

    revalidatePath(input.page === 'about' ? '/' : `/${input.page}`);
    if (input.page === 'about') {
      revalidatePath('/about');
    }

    return { success: true, data: { contentSha: written.sha } };
  } catch (error) {
    console.error('Failed to update page:', error);
    return createActionError(error, 'Failed to update page');
  }
}
