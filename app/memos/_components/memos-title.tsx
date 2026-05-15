'use client';

import { PlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { useConsecutiveClicks } from '@/hooks/use-consecutive-clicks';

import { useMemosContext } from '../_context/use-memos-context';
import MemoEditorSurface from './memo-editor-surface';

export default function MemosTitle() {
  const { isEdit, toggleEdit } = useMemosContext();
  const [mounted, setMounted] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleClick = useConsecutiveClicks({
    threshold: 5,
    onTrigger: toggleEdit,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const canEdit = mounted && isEdit;

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="cursor-default text-4xl font-bold select-none" onClick={handleClick}>
          Memos
        </h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={event => {
                event.currentTarget.blur();
                setIsEditorOpen(true);
              }}
              className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md transition-colors md:size-8"
              aria-label="Add Memo"
            >
              <PlusIcon className="size-4" />
            </button>
          </div>
        )}
      </div>

      {canEdit && isEditorOpen && <MemoEditorSurface onCancel={() => setIsEditorOpen(false)} />}
    </>
  );
}
