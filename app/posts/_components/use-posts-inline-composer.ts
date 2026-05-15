'use client';

import { useContext } from 'react';

import { PostsInlineComposerContext } from './posts-inline-composer-state';

export function usePostsInlineComposer() {
  const context = useContext(PostsInlineComposerContext);
  if (!context) {
    throw new Error('usePostsInlineComposer must be used inside PostsInlineComposerProvider');
  }
  return context;
}
