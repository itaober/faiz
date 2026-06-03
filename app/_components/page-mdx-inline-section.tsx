'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect } from 'react';

import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import { createEditorPreloader } from '@/components/editing/preload-editor';

const loadPageMdxEditorSurface = () => import('@/app/_components/page-mdx-editor-surface');
const pageMdxEditorPreloader = createEditorPreloader(loadPageMdxEditorSurface);
const PageMdxEditorSurface = dynamic(loadPageMdxEditorSurface, { ssr: false });

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

  useEffect(() => {
    if (isEditMode) {
      pageMdxEditorPreloader.preload().catch(() => undefined);
    }
  }, [isEditMode]);

  if (isEditMode) {
    return <PageMdxEditorSurface page={page} title={title} content={content} />;
  }

  return (
    <>
      <PostTitle title={title} />
      {children}
    </>
  );
}
