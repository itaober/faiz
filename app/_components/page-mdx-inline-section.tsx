'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useState } from 'react';

import PageMdxActions from '@/app/_components/page-mdx-actions';
import PostTitle from '@/app/_components/post-title';

const PageMdxEditorSurface = dynamic(() => import('@/app/_components/page-mdx-editor-surface'), {
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
  const [isEditing, setIsEditing] = useState(false);

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
        <PageMdxActions page={page} onEdit={() => setIsEditing(true)} />
      </PostTitle>
      {children}
    </>
  );
}
