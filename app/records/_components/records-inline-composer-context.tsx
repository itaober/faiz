'use client';

import { type ReactNode, useMemo, useState } from 'react';

import { RecordsInlineComposerContext } from './records-inline-composer-state';

export function RecordsInlineComposerProvider({ children }: { children: ReactNode }) {
  const [isComposerOpen, setComposerOpen] = useState(false);
  const value = useMemo(() => ({ isComposerOpen, setComposerOpen }), [isComposerOpen]);

  return (
    <RecordsInlineComposerContext.Provider value={value}>
      {children}
    </RecordsInlineComposerContext.Provider>
  );
}
