'use client';

import { PencilIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { deletePostAction } from '@/app/_actions/edit-content';
import { useEditMode } from '@/components/edit-mode-context';
import ConfirmDrawer from '@/components/editing/confirm-drawer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import type { PostMeta } from '@/lib/data/data';

interface IPostDetailActionsProps {
  post: PostMeta & { content: string };
  onEdit: () => void;
  onEditIntent?: () => void;
}

export default function PostDetailActions({ post, onEdit, onEditIntent }: IPostDetailActionsProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!token) {
      setConfirmOpen(false);
      setSettingsOpen(true);
      toast.error('Token not configured');
      return;
    }

    setIsDeleting(true);
    const deletePost = async () => {
      const result = await deletePostAction({ slug: post.slug, token });
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    };

    toast.promise(deletePost(), {
      loading: 'Deleting...',
      success: () => {
        setConfirmOpen(false);
        router.push('/posts');
        router.refresh();
        return 'Post deleted';
      },
      error: error => error.message || 'Delete failed',
      finally: () => setIsDeleting(false),
    });
  };

  return (
    <>
      <button
        type="button"
        onFocus={onEditIntent}
        onClick={event => {
          event.currentTarget.blur();
          onEdit();
        }}
        onPointerEnter={onEditIntent}
        className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
        aria-label="Edit post"
      >
        <PencilIcon className="size-4" />
      </button>
      <button
        type="button"
        onClick={event => {
          event.currentTarget.blur();
          setConfirmOpen(true);
        }}
        className="focus-ring hover:bg-danger-soft text-muted-foreground hover:text-danger flex size-8 items-center justify-center rounded-md transition-colors"
        aria-label="Delete post"
      >
        <Trash2Icon className="size-4" />
      </button>

      <ConfirmDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete post?"
        description="This removes the MDX file and updates the posts index."
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
