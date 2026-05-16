'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useState } from 'react';

import PostTitle from '@/app/_components/post-title';
import type { PostMeta } from '@/lib/data/data';

import PostDetailActions from './post-detail-actions';

const PostEditorSurface = dynamic(() => import('./post-editor-surface'), { ssr: false });

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
