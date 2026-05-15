'use client';

import dayjs from 'dayjs';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { deleteRecordAction } from '@/app/_actions/edit-content';
import { Badge } from '@/components/badge';
import { useEditMode } from '@/components/edit-mode-context';
import ConfirmDrawer from '@/components/editing/confirm-drawer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { ANIMATION } from '@/lib/constants/animation';
import type { RecordItem as RecordDataItem } from '@/lib/data/data';
import { cn } from '@/lib/utils';

import type { Tab } from '../_constants';
import RecordEditorSurface from './record-editor-surface';
import RecordPreview from './record-preview';

interface IRecordItemProps extends RecordDataItem {
  tab: Tab;
  typeLabel?: string;
  preloadCover?: boolean;
}

export default function RecordItem({
  title,
  link,
  coverUrl,
  createdTime,
  rating,
  comment,
  tab,
  typeLabel,
  type,
  preloadCover = false,
}: IRecordItemProps) {
  const router = useRouter();
  const { isEditMode, token } = useEditMode();
  const [mounted, setMounted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMusicTab = tab === 'music';
  const previewComment = comment?.trim();
  const coverSizes =
    '(max-width: 640px) calc((100vw - 4rem) / 2), (max-width: 768px) calc((100vw - 5rem) / 3), 11rem';
  const record = { title, link, coverUrl, createdTime, rating, comment, type };
  const canEdit = mounted && isEditMode;

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDelete = async () => {
    if (!token) {
      setConfirmOpen(false);
      setSettingsOpen(true);
      toast.error('Token not configured');
      return;
    }

    setIsDeleting(true);
    const deleteRecord = async () => {
      const result = await deleteRecordAction({
        original: { title, type, createdTime },
        token,
      });
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      return result;
    };

    toast.promise(deleteRecord(), {
      loading: 'Deleting...',
      success: () => {
        setConfirmOpen(false);
        router.refresh();
        return 'Record deleted';
      },
      error: error => error.message || 'Delete failed',
      finally: () => setIsDeleting(false),
    });
  };

  if (editorOpen) {
    return (
      <div className="col-span-2 sm:col-span-3 md:col-span-4">
        <RecordEditorSurface record={record} onCancel={() => setEditorOpen(false)} />
      </div>
    );
  }

  return (
    <motion.div
      className="group hover:bg-muted/45 flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-200"
      variants={{
        hidden: { opacity: 0, y: ANIMATION.distance.small },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration: ANIMATION.duration.normal }}
      whileHover={{
        y: -ANIMATION.distance.minimal,
        transition: { duration: ANIMATION.duration.fast },
      }}
    >
      <Preview>
        <PreviewTrigger ariaLabel={`Open cover preview: ${title}`} className="rounded-md">
          <div className="overflow-hidden rounded-md">
            <Image
              src={coverUrl}
              alt={title}
              width={0}
              height={0}
              sizes={coverSizes}
              loading={preloadCover ? 'eager' : undefined}
              preload={preloadCover}
              className={cn(
                'relative aspect-[2/3] w-full rounded object-cover transition-transform duration-300 group-hover:scale-[1.015]',
                {
                  'aspect-square': isMusicTab,
                },
              )}
            />
          </div>
        </PreviewTrigger>
        <PreviewPortal
          ariaLabel={`Record preview: ${title}`}
          sidecar={previewComment ? <RecordPreview record={record} /> : undefined}
        >
          <PreviewImage src={coverUrl} alt={title} />
        </PreviewPortal>
      </Preview>
      <Link
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${title} (opens in a new tab)`}
        className="truncate text-sm font-medium hover:underline"
      >
        {title}
      </Link>
      <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-sm">
        {rating !== undefined && <span>{rating.toFixed(1)}</span>}
        {rating !== undefined && <span>·</span>}
        <span>{dayjs(createdTime).format('MMM DD')}</span>
        {typeLabel && <span>·</span>}
        {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
      </div>
      {canEdit && (
        <div className="flex items-center justify-start gap-0.5">
          <button
            type="button"
            onClick={event => {
              event.currentTarget.blur();
              setEditorOpen(true);
            }}
            className="focus-ring pressable hover:bg-muted text-muted-foreground hover:text-foreground flex size-11 items-center justify-center rounded-md md:size-7"
            aria-label={`Edit ${title}`}
          >
            <PencilIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={event => {
              event.currentTarget.blur();
              setConfirmOpen(true);
            }}
            className="focus-ring pressable hover:bg-danger-soft text-muted-foreground hover:text-danger flex size-11 items-center justify-center rounded-md md:size-7"
            aria-label={`Delete ${title}`}
          >
            <Trash2Icon className="size-3.5" />
          </button>
        </div>
      )}
      <ConfirmDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete record?"
        description="This removes the entry from records.json."
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </motion.div>
  );
}
