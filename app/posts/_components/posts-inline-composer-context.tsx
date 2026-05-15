'use client';

import { type ReactNode, useMemo, useState } from 'react';

import { PostsInlineComposerContext } from './posts-inline-composer-state';

export function PostsInlineComposerProvider({ children }: { children: ReactNode }) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const value = useMemo(() => ({ isComposerOpen, setComposerOpen }), [isComposerOpen]);

  return (
    <PostsInlineComposerContext.Provider value={value}>
      {children}
    </PostsInlineComposerContext.Provider>
  );
}
