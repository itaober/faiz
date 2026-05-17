'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import PageMdxActions from '@/app/_components/page-mdx-actions';
import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import { createEditorPreloader } from '@/components/editing/preload-editor';

const loadPageMdxEditorSurface = () => import('@/app/_components/page-mdx-editor-surface');
const pageMdxEditorPreloader = createEditorPreloader(loadPageMdxEditorSurface);
const PageMdxEditorSurface = dynamic(loadPageMdxEditorSurface, {
  ssr: false,
});

interface IPageMdxInlineSectionProps {
  page: 'about' | 'lines';
  title: string;
  content: string;
  children: ReactNode;
}

export default function PageMdxInlineSection({
  page,
  title,
  content,
  children,
}: IPageMdxInlineSectionProps) {
  const { isEditMode } = useEditMode();
  const [isEditing, setIsEditing] = useState(false);
  const preloadEditor = useCallback(() => {
    pageMdxEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    pageMdxEditorPreloader.openAfterPreload(() => setIsEditing(true)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isEditMode) {
      preloadEditor();
    }
  }, [isEditMode, preloadEditor]);

  if (isEditing) {
    return (
      <PageMdxEditorSurface
        page={page}
        title={title}
        content={content}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  return (
    <>
      <PostTitle title={title}>
        <PageMdxActions page={page} onEdit={openEditor} onEditIntent={preloadEditor} />
      </PostTitle>
      {children}
    </>
  );
}
