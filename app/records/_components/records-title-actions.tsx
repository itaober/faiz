'use client';

import { PlusIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';

const RecordEditorDrawer = dynamic(() => import('./record-editor-drawer'), { ssr: false });

export default function RecordsTitleActions() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={event => {
          event.currentTarget.blur();
          setOpen(true);
        }}
        className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md transition-colors md:size-8"
        aria-label="Add record"
      >
        <PlusIcon className="size-4" />
      </button>
      <RecordEditorDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}
