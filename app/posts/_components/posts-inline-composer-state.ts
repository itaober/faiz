import { createContext } from 'react';

export interface IPostsInlineComposerContext {
  isComposerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
}

export const PostsInlineComposerContext = createContext<IPostsInlineComposerContext | null>(null);
