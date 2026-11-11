'use client';

import { createContext } from 'react';

export interface IMemosContext {
  isEdit: boolean;
  toggleEdit: () => void;
  /** The single open memo editor: `'compose'` for a new memo, or a memo id. */
  editingId: string | null;
  setEditingId: (id: string | null) => void;
}

export const MemosContext = createContext<IMemosContext>({
  isEdit: false,
  toggleEdit: () => {},
  editingId: null,
  setEditingId: () => {},
});
