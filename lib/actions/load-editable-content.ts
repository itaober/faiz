'use server';

import matter from 'gray-matter';
import { headers } from 'next/headers';

import { type EditablePage, isEditablePage } from '@/lib/content-editing-validation';
import { CONTENT_KEYS } from '@/lib/content-keys';
import { createRateLimiter } from '@/lib/server/rate-limit';
import { readContentForUpdate } from '@/lib/storage/r2';
import {
  type ActionResult,
  createActionError,
  notFoundError,
  validationError,
} from '@/lib/types/action-result';

export type EditableContentTarget =
  | { kind: 'post'; slug: string }
  | { kind: 'page'; page: EditablePage };

export interface EditableContent {
  content: string;
  /** Revision that was loaded, so a save can detect a conflict. */
  revision: string;
}

const POST_SLUG_PATTERN = /^[a-z0-9-]+$/;

// Each call is an uncached storage read, and it needs no sign-in, so it is capped like sign-in is.
const allowLoad = createRateLimiter({ windowMs: 60 * 1000, max: 30 });

const resolveKey = (target: EditableContentTarget) => {
  if (target.kind === 'page') {
    return isEditablePage(target.page) ? CONTENT_KEYS.page(target.page) : null;
  }

  return POST_SLUG_PATTERN.test(target.slug) ? CONTENT_KEYS.post(target.slug) : null;
};

/**
 * Loads the raw MDX body for an editor. Pages ship only their rendered output,
 * so the source is fetched when someone actually opens the editor rather than
 * riding along in every visitor's payload.
 *
 * Unauthenticated on purpose — this returns content that is already public. The
 * revision it returns is what the matching save sends back to prove nothing
 * changed underneath.
 */
export async function loadEditableContentAction(
  target: EditableContentTarget,
): Promise<ActionResult<EditableContent>> {
  if (!allowLoad(await headers())) {
    return {
      success: false,
      error: 'Too many requests. Try again in a minute.',
      code: 'RATE_LIMIT',
      retryable: true,
    };
  }

  const key = resolveKey(target);
  if (!key) {
    return validationError('Invalid content target');
  }

  try {
    const file = await readContentForUpdate(key);
    if (!file) {
      return notFoundError('Content not found');
    }

    return {
      success: true,
      data: { content: matter(file.text).content, revision: file.revision },
    };
  } catch (error) {
    console.error('Failed to load editable content:', key, error);
    return createActionError(error, 'Failed to load content');
  }
}
