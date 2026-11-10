'use server';

import matter from 'gray-matter';
import { revalidatePath } from 'next/cache';

import { type EditablePage, isEditablePage } from '@/lib/content-editing-validation';
import { CONTENT_KEYS } from '@/lib/content-keys';
import { formatTime } from '@/lib/dayjs';
import { requireEditSession } from '@/lib/server/edit-session';
import { normalizeOptionalString, writeMdx } from '@/lib/server/mdx-write';
import { readContentForUpdate } from '@/lib/storage/r2';
import { type ActionResult, createActionError, validationError } from '@/lib/types/action-result';

interface IUpdatePageInput {
  page: EditablePage;
  title: string;
  content: string;
  /** Revision the editor loaded, so a concurrent edit is rejected instead of overwritten. */
  revision?: string;
}

/** A save returns the revision it produced, so the open editor can save again. */
export interface IPageSaveResult {
  revision: string;
}

export async function updatePageAction(
  input: IUpdatePageInput,
): Promise<ActionResult<IPageSaveResult>> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
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
    const key = CONTENT_KEYS.page(input.page);
    const current = await readContentForUpdate(key);
    const parsed = matter(current?.text ?? '');
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
      key,
      data,
      input.content,
      input.revision ?? current?.revision ?? null,
    );

    revalidatePath(input.page === 'about' ? '/' : `/${input.page}`);
    if (input.page === 'about') {
      revalidatePath('/about');
    }

    return { success: true, data: { revision: written.revision } };
  } catch (error) {
    console.error('Failed to update page:', error);
    return createActionError(error, 'Failed to update page');
  }
}
