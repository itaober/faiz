'use client';

import dayjs from 'dayjs';
import { motion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback } from 'react';

import { Badge } from '@/components/badge';
import { useEditMode } from '@/components/edit-mode-context';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import { useMounted } from '@/hooks/use-mounted';
import { ANIMATION } from '@/lib/constants/animation';
import type { RecordItem as RecordDataItem } from '@/lib/data/data';
import { cn } from '@/lib/utils';

import type { Tab } from '../_constants';
import { useRecordsInlineComposer } from './use-records-inline-composer';

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
  const { isEditMode } = useEditMode();
  const { editingRecordKey, setEditingRecordKey, mode } = useRecordsInlineComposer();
  const mounted = useMounted();
  const isMusicTab = tab === 'music';
  const recordKey = `${type}-${createdTime}-${title}`;
  const coverSizes =
    '(max-width: 640px) calc((100vw - 4rem) / 2), (max-width: 768px) calc((100vw - 5rem) / 3), 11rem';
  // Editable only in the records "edit" sub-mode; in "preview" the cover opens the lightbox.
  const canEdit = mounted && isEditMode && mode === 'wysiwyg';
  const isSelected = editingRecordKey === recordKey;

  const openEditor = useCallback(() => {
    setEditingRecordKey(recordKey);
  }, [recordKey, setEditingRecordKey]);

  const reviewParagraphs = comment
    ? comment
        .split(/\n+/)
        .map(paragraph => paragraph.trim())
        .filter(Boolean)
    : [];

  const coverImage = (
    <Image
      src={coverUrl}
      alt={title}
      width={0}
      height={0}
      sizes={coverSizes}
      loading={preloadCover ? 'eager' : undefined}
      preload={preloadCover}
      className={cn(
        'fz-img-outline relative aspect-[2/3] w-full rounded-md object-cover transition-transform duration-(--fz-dur-slow)',
        isMusicTab && 'aspect-square',
        !canEdit && 'group-hover:scale-[1.015]',
      )}
    />
  );

  return (
    <motion.div
      className={cn(
        // rounded-xl keeps the card concentric with the rounded-md cover inside
        // its 6px padding (12 = 6 + 6).
        'group relative flex flex-col gap-1 rounded-xl border border-transparent p-1.5 transition-colors duration-(--fz-dur-normal)',
        canEdit ? 'cursor-pointer' : 'hover:bg-muted/45',
      )}
      data-selected={isSelected || undefined}
      data-record-key={`record:${type}:${createdTime}:${title}`}
      whileHover={
        canEdit
          ? undefined
          : { y: -ANIMATION.distance.minimal, transition: { duration: ANIMATION.duration.fast } }
      }
    >
      {canEdit ? (
        <div
          className={cn(
            'overflow-hidden rounded-md transition-shadow',
            isSelected
              ? 'shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--foreground)]'
              : 'group-hover:shadow-[0_0_0_2px_var(--background),0_0_0_3px_var(--border)]',
          )}
        >
          {coverImage}
        </div>
      ) : (
        <Preview>
          <PreviewTrigger
            previewSrc={coverUrl}
            ariaLabel={`Open cover preview: ${title}`}
            className="rounded-md"
          >
            <div className="overflow-hidden rounded-md">{coverImage}</div>
          </PreviewTrigger>
          <PreviewPortal
            ariaLabel={`Cover preview: ${title}`}
            sidecar={
              reviewParagraphs.length ? (
                <div className="fz-review-overlay">
                  {reviewParagraphs.map(paragraph => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              ) : undefined
            }
          >
            <PreviewImage src={coverUrl} alt={title} />
          </PreviewPortal>
        </Preview>
      )}

      {canEdit ? (
        <span className="truncate text-sm font-medium">{title}</span>
      ) : (
        <Link
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${title} (opens in a new tab)`}
          className="truncate text-sm font-medium hover:underline"
        >
          {title}
        </Link>
      )}

      <div className="text-muted-foreground flex items-center gap-1 text-sm">
        {rating !== undefined && <span>{rating.toFixed(1)}</span>}
        {rating !== undefined && <span>·</span>}
        <span>{dayjs(createdTime).format('MMM DD')}</span>
        {typeLabel && <span>·</span>}
        {typeLabel && <Badge variant="outline">{typeLabel}</Badge>}
      </div>

      {canEdit && (
        <button
          type="button"
          aria-label={`Edit ${title}`}
          onClick={openEditor}
          className="focus-ring absolute inset-0 z-[2] rounded-xl"
        />
      )}
    </motion.div>
  );
}
