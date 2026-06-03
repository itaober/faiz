'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useEffect } from 'react';

import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import { createEditorPreloader } from '@/components/editing/preload-editor';
import type { PostMeta } from '@/lib/data/data';

const loadPostEditorSurface = () => import('./post-editor-surface');
const postEditorPreloader = createEditorPreloader(loadPostEditorSurface);
const PostEditorSurface = dynamic(loadPostEditorSurface, { ssr: false });

interface IPostDetailInlineSectionProps {
  post: PostMeta & { content: string };
  children: ReactNode;
}

export default function PostDetailInlineSection({ post, children }: IPostDetailInlineSectionProps) {
  const { isEditMode, setEditMode } = useEditMode();

  useEffect(() => {
    if (isEditMode) {
      postEditorPreloader.preload().catch(() => undefined);
    }
  }, [isEditMode]);

  if (isEditMode) {
    return <PostEditorSurface post={post} onExit={() => setEditMode(false)} />;
  }

  return (
    <>
      <PostTitle {...post} />
      {children}
    </>
  );
}
