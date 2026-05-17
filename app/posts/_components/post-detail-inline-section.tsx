'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import { createEditorPreloader } from '@/components/editing/preload-editor';
import type { PostMeta } from '@/lib/data/data';

import PostDetailActions from './post-detail-actions';

const loadPostEditorSurface = () => import('./post-editor-surface');
const postEditorPreloader = createEditorPreloader(loadPostEditorSurface);
const PostEditorSurface = dynamic(loadPostEditorSurface, { ssr: false });

interface IPostDetailInlineSectionProps {
  post: PostMeta & { content: string };
  children: ReactNode;
}

export default function PostDetailInlineSection({ post, children }: IPostDetailInlineSectionProps) {
  const { isEditMode } = useEditMode();
  const [isEditing, setIsEditing] = useState(false);
  const preloadEditor = useCallback(() => {
    postEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    postEditorPreloader.openAfterPreload(() => setIsEditing(true)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (isEditMode) {
      preloadEditor();
    }
  }, [isEditMode, preloadEditor]);

  if (isEditing) {
    return <PostEditorSurface post={post} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <>
      <PostTitle {...post}>
        <PostDetailActions post={post} onEdit={openEditor} onEditIntent={preloadEditor} />
      </PostTitle>
      {children}
    </>
  );
}
