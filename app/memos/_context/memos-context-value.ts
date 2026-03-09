'use client';

import { createContext } from 'react';

export interface IMemosContext {
  isEdit: boolean;
  toggleEdit: () => void;
  token: string | null;
  saveToken: (token: string) => void;
}

export const MemosContext = createContext<IMemosContext>({
  isEdit: false,
  toggleEdit: () => {},
  token: null,
  saveToken: () => {},
});
