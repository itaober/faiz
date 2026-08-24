'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import { createEditorPreloader } from '@/components/editing/preload-editor';
import type { EditablePage } from '@/lib/content-editing-validation';
import { type EditableContent, loadEditableContentAction } from '@/lib/edit-api';

const loadPageMdxEditorSurface = () => import('@/app/_components/page-mdx-editor-surface');
const pageMdxEditorPreloader = createEditorPreloader(loadPageMdxEditorSurface);
const PageMdxEditorSurface = dynamic(loadPageMdxEditorSurface, { ssr: false });

interface IPageMdxInlineSectionProps {
  page: EditablePage;
  title: string;
  children: ReactNode;
}

export default function PageMdxInlineSection({
  page,
  title,
  children,
}: IPageMdxInlineSectionProps) {
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
      pageMdxEditorPreloader.preload().catch(() => undefined),
      loadEditableContentAction({ kind: 'page', page }),
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
  }, [isEditMode, page, setEditMode]);

  // Until the body arrives the reading view stays up, so there is no extra
  // loading state to design.
  if (isEditMode && draft) {
    return (
      <PageMdxEditorSurface
        page={page}
        title={title}
        initialContent={draft.content}
        sha={draft.sha}
      />
    );
  }

  return (
    <>
      <PostTitle title={title} />
      {children}
    </>
  );
}
