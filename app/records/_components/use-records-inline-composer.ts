'use client';

import { useContext } from 'react';

import { RecordsInlineComposerContext } from './records-inline-composer-state';

export function useRecordsInlineComposer() {
  const context = useContext(RecordsInlineComposerContext);
  if (!context) {
    throw new Error('useRecordsInlineComposer must be used inside RecordsInlineComposerProvider');
  }
  return context;
}
