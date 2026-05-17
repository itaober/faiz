'use client';

import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { deleteMemoAction } from '@/app/memos/_actions/delete-memo';
import ConfirmDrawer from '@/components/editing/confirm-drawer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import type { Memo } from '@/lib/data/memos';

import { useMemosContext } from '../_context/use-memos-context';

interface MemoCardActionsProps {
  memo: Memo;
  onEdit: () => void;
  onEditIntent?: () => void;
}

export default function MemoCardActions({ memo, onEdit, onEditIntent }: MemoCardActionsProps) {
  const router = useRouter();
  const { isEdit, token } = useMemosContext();
  const [mounted, setMounted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isEdit) {
    return null;
  }

  const handleDelete = async () => {
    if (!token) {
      setShowDeleteConfirm(false);
      setSettingsOpen(true);
      toast.error('Token not configured');
      return;
    }

    setIsDeleting(true);
    const deleteMemo = async () => {
      const result = await deleteMemoAction({
        id: memo.id,
        createdTime: memo.createdTime,
        token,
      });
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    };

    toast.promise(deleteMemo(), {
      loading: 'Deleting...',
      success: () => {
        setShowDeleteConfirm(false);
        router.refresh();
        return 'Memo deleted';
      },
      error: error => error.message || 'Delete failed',
      finally: () => setIsDeleting(false),
    });
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onFocus={onEditIntent}
          onClick={event => {
            event.currentTarget.blur();
            onEdit();
          }}
          onPointerEnter={onEditIntent}
          className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
          aria-label="Edit memo"
        >
          <PencilIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={event => {
            event.currentTarget.blur();
            setShowDeleteConfirm(true);
          }}
          className="focus-ring hover:bg-danger-soft text-muted-foreground hover:text-danger flex size-8 items-center justify-center rounded-md transition-colors"
          aria-label="Delete memo"
        >
          <Trash2Icon className="size-4" />
        </button>
      </div>

      <ConfirmDrawer
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete memo?"
        description="This removes the memo from the content branch."
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
