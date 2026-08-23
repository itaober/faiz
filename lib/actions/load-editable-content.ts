'use server';

import matter from 'gray-matter';

import {
  EDITABLE_PAGE_PATHS,
  type EditablePage,
  isEditablePage,
} from '@/lib/content-editing-validation';
import { fetchGitHubFileWithSha } from '@/lib/data/common';
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
 * Unauthenticated on purpose — this returns content that is already public. It
 * uses the server token, and the SHA it returns is what the matching save sends
 * back to prove nothing changed underneath.
 */
export async function loadEditableContentAction(
  target: EditableContentTarget,
): Promise<ActionResult<EditableContent>> {
  const path = resolvePath(target);
  if (!path) {
    return validationError('Invalid content target');
  }

  try {
    const file = await fetchGitHubFileWithSha(path);
    if (!file) {
      return notFoundError('Content not found');
    }

    return { success: true, data: { content: matter(file.text).content, sha: file.sha } };
  } catch (error) {
    console.error('Failed to load editable content:', path, error);
    return createActionError(error, 'Failed to load content');
  }
}
