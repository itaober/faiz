'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { deleteMemoAction } from '@/app/memos/_actions/delete-memo';

import { useMemosContext } from '../_context/memos-context';

interface MemoActionsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memoId: string;
  memoCreatedTime: string;
  onEdit: () => void;
}

export default function MemoActionsDrawer({
  open,
  onOpenChange,
  memoId,
  memoCreatedTime,
  onEdit,
}: MemoActionsDrawerProps) {
  const router = useRouter();
  const { token } = useMemosContext();
  const [isConfirmDelete, setIsConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset state when closing
      setIsConfirmDelete(false);
    }
    onOpenChange(newOpen);
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error('Token not configured');
      return;
    }

    setIsDeleting(true);

    const deleteMemo = async () => {
      const result = await deleteMemoAction({ id: memoId, createdTime: memoCreatedTime, token });
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    };

    toast.promise(deleteMemo(), {
      loading: 'Deleting...',
      success: () => {
        onOpenChange(false);
        router.refresh();
        return 'Memo deleted';
      },
      error: err => err.message || 'Delete failed',
      finally: () => setIsDeleting(false),
    });
  };

  return (
    <Drawer.Root open={open} onOpenChange={handleOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="bg-foreground/40 fixed inset-0 z-20" />
        <Drawer.Content className="bg-background fixed right-0 bottom-0 left-0 z-20 rounded-t-xl outline-none">
          <Drawer.Handle className="mt-2" />
          <Drawer.Title className="sr-only">Memo Actions</Drawer.Title>

          {!isConfirmDelete ? (
            <div className="space-y-2 divide-y divide-gray-100 pt-2 pb-6 dark:divide-gray-800">
              {/* Edit */}
              <button
                type="button"
                onClick={() => {
                  onEdit();
                  onOpenChange(false);
                }}
                className="flex w-full items-center justify-center gap-3 py-3"
              >
                <span>Edit</span>
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => setIsConfirmDelete(true)}
                className="flex w-full items-center justify-center gap-3 py-3 text-red-600"
              >
                <span>Delete</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2 px-4 pt-2 pb-6">
              {/* Confirm Delete */}
              <p className="text-muted-foreground py-2 text-center text-sm">Confirm delete?</p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsConfirmDelete(false)}
                  disabled={isDeleting}
                  className="bg-muted hover:bg-muted/80 flex-1 rounded-lg border border-gray-200 px-4 py-3 transition-colors dark:border-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-500 transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
