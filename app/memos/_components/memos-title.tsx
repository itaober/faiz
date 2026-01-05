'use client';

import { EditIcon } from 'lucide-react';
import { useState } from 'react';

import { useConsecutiveClicks } from '@/hooks/use-consecutive-clicks';

import { useMemosContext } from '../_context/memos-context';
import MemosEditorDrawer from './memo-editor-drawer';

export default function MemosTitle() {
  const { isEdit, toggleEdit } = useMemosContext();
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const handleClick = useConsecutiveClicks({
    threshold: 10,
    onTrigger: toggleEdit,
  });

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h1 className="cursor-default text-4xl font-extrabold select-none" onClick={handleClick}>
          Memos
        </h1>
        {isEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditorOpen(true)}
              className="flex size-5 items-center justify-center rounded-lg opacity-70 transition-colors hover:opacity-100"
              aria-label="Add Memo"
            >
              <EditIcon />
            </button>
          </div>
        )}
      </div>

      <MemosEditorDrawer open={isEditorOpen} onOpenChange={setIsEditorOpen} />
    </>
  );
}
