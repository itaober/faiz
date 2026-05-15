'use client';

import { type ReactNode, useState } from 'react';

import PostTitle from '@/app/_components/post-title';
import type { PostMeta } from '@/lib/data/data';

import PostDetailActions from './post-detail-actions';
import PostEditorSurface from './post-editor-surface';

interface IPostDetailInlineSectionProps {
  post: PostMeta & { content: string };
  children: ReactNode;
}

export default function PostDetailInlineSection({ post, children }: IPostDetailInlineSectionProps) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return <PostEditorSurface post={post} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <>
      <PostTitle {...post}>
        <PostDetailActions post={post} onEdit={() => setIsEditing(true)} />
      </PostTitle>
      {children}
    </>
  );
}
