import { createContext } from 'react';

import type { EditViewMode } from '@/components/editing/action-bar';

export interface IRecordsInlineComposerContext {
  editingRecordKey: string | null;
  isComposerOpen: boolean;
  setComposerOpen: (open: boolean) => void;
  setEditingRecordKey: (key: string | null) => void;
  /** Records-local view mode: `preview` opens covers in the lightbox, `wysiwyg` edits. */
  mode: EditViewMode;
  setMode: (mode: EditViewMode) => void;
}

export const RecordsInlineComposerContext = createContext<IRecordsInlineComposerContext | null>(
  null,
);
