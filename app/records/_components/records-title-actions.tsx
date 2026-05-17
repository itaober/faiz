'use client';

import { PlusIcon } from 'lucide-react';
import { useCallback, useEffect } from 'react';

import { recordEditorPreloader } from './record-editor-loader';
import { useRecordsInlineComposer } from './use-records-inline-composer';

export default function RecordsTitleActions() {
  const { setComposerOpen } = useRecordsInlineComposer();
  const preloadEditor = useCallback(() => {
    recordEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    recordEditorPreloader.openAfterPreload(() => setComposerOpen(true)).catch(() => undefined);
  }, [setComposerOpen]);

  useEffect(() => {
    preloadEditor();
  }, [preloadEditor]);

  return (
    <button
      type="button"
      onFocus={preloadEditor}
      onClick={event => {
        event.currentTarget.blur();
        openEditor();
      }}
      onPointerEnter={preloadEditor}
      className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md transition-colors md:size-8"
      aria-label="Add record"
    >
      <PlusIcon className="size-4" />
    </button>
  );
}
