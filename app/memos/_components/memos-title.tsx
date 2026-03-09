'use client';

import { EditIcon } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

import { useConsecutiveClicks } from '@/hooks/use-consecutive-clicks';

import { useMemosContext } from '../_context/use-memos-context';
const MemosEditorDrawer = dynamic(() => import('./memo-editor-drawer'), { ssr: false });

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
              onClick={() => setIsEditorOpen(true)}
              className="focus-visible:ring-foreground/40 hover:text-foreground flex size-5 items-center justify-center rounded-lg opacity-70 transition-[color,opacity] hover:opacity-100 focus-visible:ring-2 focus-visible:outline-none"
              aria-label="Add Memo"
            >
              <EditIcon />
            </button>
          </div>
        )}
      </div>

      {(canEdit || isEditorOpen) && (
        <MemosEditorDrawer open={isEditorOpen} onOpenChange={setIsEditorOpen} />
      )}
    </>
  );
}
