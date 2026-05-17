'use client';

import dayjs from 'dayjs';
import { PencilIcon, Trash2Icon } from 'lucide-react';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
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
import { loadRecordEditorSurface, recordEditorPreloader } from './record-editor-loader';
import { useRecordsInlineComposer } from './use-records-inline-composer';

const RecordEditorSurface = dynamic(loadRecordEditorSurface, { ssr: false });

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
  const { editingRecordKey, setEditingRecordKey } = useRecordsInlineComposer();
  const [mounted, setMounted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isMusicTab = tab === 'music';
  const recordKey = `${type}-${createdTime}-${title}`;
  const coverSizes =
    '(max-width: 640px) calc((100vw - 4rem) / 2), (max-width: 768px) calc((100vw - 5rem) / 3), 11rem';
  const record = { title, link, coverUrl, createdTime, rating, comment, type };
  const canEdit = mounted && isEditMode;
  const editorOpen = editingRecordKey === recordKey;
  const preloadEditor = useCallback(() => {
    recordEditorPreloader.preload().catch(() => undefined);
  }, []);
  const openEditor = useCallback(() => {
    recordEditorPreloader
      .openAfterPreload(() => setEditingRecordKey(recordKey))
      .catch(() => undefined);
  }, [recordKey, setEditingRecordKey]);

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
      <motion.div
        className="group flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-200"
        variants={{
          hidden: { opacity: 0, y: ANIMATION.distance.small },
          visible: { opacity: 1, y: 0 },
        }}
        transition={{ duration: ANIMATION.duration.normal }}
      >
        <RecordEditorSurface
          record={record}
          showTypeInMeta={tab === 'all'}
          squareCover={isMusicTab}
          onCancel={() => setEditingRecordKey(null)}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      className="group hover:bg-muted/45 relative flex flex-col gap-1 rounded-md border border-transparent p-1.5 transition-colors duration-200"
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
        <PreviewPortal ariaLabel={`Cover preview: ${title}`}>
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
      <div className="text-muted-foreground flex items-center gap-1 text-sm">
        {rating !== undefined && <span>{rating.toFixed(1)}</span>}
        {rating !== undefined && <span>·</span>}
        <span>{dayjs(createdTime).format('MMM DD')}</span>
        {typeLabel && <span>·</span>}
        {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
      </div>
      {canEdit && (
        <div className="bg-background/90 border-border pointer-events-auto absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-md border p-0.5 opacity-100 shadow-sm backdrop-blur transition-opacity md:pointer-events-none md:opacity-0 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100 md:group-hover:pointer-events-auto md:group-hover:opacity-100">
          <button
            type="button"
            onFocus={preloadEditor}
            onClick={event => {
              event.currentTarget.blur();
              openEditor();
            }}
            onPointerEnter={preloadEditor}
            className="focus-ring pressable hover:bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-sm md:size-7"
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
            className="focus-ring pressable hover:bg-danger-soft text-muted-foreground hover:text-danger flex size-8 items-center justify-center rounded-sm md:size-7"
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
