import { createContext } from 'react';

export interface IRecordsInlineComposerContext {
  editingRecordKey: string | null;
  isComposerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
  setEditingRecordKey: (key: string | null) => void;
}

export const RecordsInlineComposerContext = createContext<IRecordsInlineComposerContext | null>(
  null,
);
