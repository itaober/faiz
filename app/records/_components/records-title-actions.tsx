'use client';

import { PlusIcon } from 'lucide-react';

import { useRecordsInlineComposer } from './use-records-inline-composer';

export default function RecordsTitleActions() {
  const { setComposerOpen } = useRecordsInlineComposer();

  return (
    <button
      type="button"
      onClick={event => {
        event.currentTarget.blur();
        setComposerOpen(true);
      }}
      className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md transition-colors md:size-8"
      aria-label="Add record"
    >
      <PlusIcon className="size-4" />
    </button>
  );
}
