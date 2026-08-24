'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import { createEditorPreloader } from '@/components/editing/preload-editor';
import type { PostMeta } from '@/lib/data/data';
import { type EditableContent, loadEditableContentAction } from '@/lib/edit-api';

const loadPostEditorSurface = () => import('./post-editor-surface');
const postEditorPreloader = createEditorPreloader(loadPostEditorSurface);
const PostEditorSurface = dynamic(loadPostEditorSurface, { ssr: false });

interface IPostDetailInlineSectionProps {
  post: PostMeta;
  children: ReactNode;
}

export default function PostDetailInlineSection({ post, children }: IPostDetailInlineSectionProps) {
  const { isEditMode, setEditMode } = useEditMode();
  const [draft, setDraft] = useState<EditableContent | null>(null);

  useEffect(() => {
    if (!isEditMode) {
      // Drop it so re-entering the editor re-reads the file (and its SHA).
      setDraft(null);
      return;
    }

    let active = true;
    Promise.all([
      postEditorPreloader.preload().catch(() => undefined),
      loadEditableContentAction({ kind: 'post', slug: post.slug }),
    ]).then(([, result]) => {
      if (!active) {
        return;
      }
      if (!result.success) {
        toast.error(result.error);
        setEditMode(false);
        return;
      }
      setDraft(result.data ?? null);
    });

    return () => {
      active = false;
    };
  }, [isEditMode, post.slug, setEditMode]);

  // Until the body arrives the reading view stays up, so there is no extra
  // loading state to design.
  if (isEditMode && draft) {
    return (
      <PostEditorSurface
        post={post}
        initialContent={draft.content}
        sha={draft.sha}
        onExit={() => setEditMode(false)}
      />
    );
  }

  return (
    <>
      <PostTitle {...post} tocAnchor />
      {children}
    </>
  );
}
