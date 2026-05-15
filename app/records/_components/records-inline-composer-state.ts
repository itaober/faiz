import { createContext } from 'react';

export interface IRecordsInlineComposerContext {
  isComposerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
}

export const RecordsInlineComposerContext = createContext<IRecordsInlineComposerContext | null>(
  null,
);
