'use client';

import { ImagePlusIcon, KeyRoundIcon, StarIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';
import { useEditMode } from '@/components/edit-mode-context';
import ConfirmDrawer from '@/components/editing/confirm-drawer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import Segmented from '@/components/segmented';
import { useContentEditor } from '@/hooks/use-content-editor';
import { useCoverImage } from '@/hooks/use-cover-image';
import { useSaveShortcut } from '@/hooks/use-save-shortcut';
import {
  createRecordAction,
  deleteRecordAction,
  updateRecordAction,
} from '@/lib/actions/edit-record';
import { SUPPORTED_IMAGE_TYPES } from '@/lib/constants/image';
import type { RecordItem } from '@/lib/data/data';
import { buildEditorImageStoragePath } from '@/lib/utils/editor-image';

import { tabList } from '../_constants';

// Reuse the read-side tab labels so the type segment stays in sync (e.g. "TV").
const typeOptions = tabList.filter(tab => tab.value !== 'all') as {
  label: string;
  value: RecordItem['type'];
}[];

// Ratings are stored 0-10; each star is worth 2.
const STAR_POSITIONS = [1, 2, 3, 4, 5];

interface IRecordsSidePanelProps {
  record?: RecordItem;
  initialType?: RecordItem['type'];
  onClose: () => void;
}

const formatDateInput = (value?: string) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
};

export default function RecordsSidePanel({
  record,
  initialType = 'movie',
  onClose,
}: IRecordsSidePanelProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const isEdit = !!record;
  const hasToken = !!token;

  const {
    settingsOpen,
    setSettingsOpen,
    confirmOpen,
    setConfirmOpen,
    isSubmitting,
    isDeleting,
    submit,
    remove,
  } = useContentEditor(token);
  const [title, setTitle] = useState(record?.title ?? '');
  const [type, setType] = useState<RecordItem['type']>(record?.type ?? initialType);
  const { coverPreviewSrc, hasCover, pendingFile, stageCoverFile, clearPendingCover, uploadCover } =
    useCoverImage(record?.coverUrl ?? '');
  // Cover filename slug — follows the title until manually overridden (null = follow).
  const [coverName, setCoverName] = useState<string | null>(null);
  const [link, setLink] = useState(record?.link ?? '');
  const [createdTime, setCreatedTime] = useState(formatDateInput(record?.createdTime));
  const [rating, setRating] = useState(record?.rating !== undefined ? String(record.rating) : '');
  const [comment, setComment] = useState(record?.comment ?? '');
  const [isDragging, setIsDragging] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Cover is stored at assets/records/{type}_{name}.webp — `name` defaults to the
  // title but is editable (the Image name field) for awkward titles.
  const coverImageName = (coverName ?? title).trim() || 'cover';
  const isSaveDisabled = isSubmitting || !title.trim() || !link.trim() || !hasCover;
  const ratingStars = Math.round((Number(rating) || 0) / 2);

  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) {
      return;
    }
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  };

  const parsedRating = rating.trim() ? Number(rating) : undefined;

  const handleSubmit = () => {
    // Validate only once a token exists, so a token-less save still routes to the
    // connect-token drawer first (matching the prior gate ordering).
    if (hasToken && parsedRating !== undefined && Number.isNaN(parsedRating)) {
      toast.error('Invalid rating');
      return;
    }
    submit({
      loading: pendingFile ? 'Uploading cover...' : isEdit ? 'Updating...' : 'Saving...',
      success: isEdit ? 'Record updated' : 'Record saved',
      errorFallback: 'Save failed',
      onSuccess: () => {
        clearPendingCover();
        onClose();
        router.refresh();
      },
      run: async token => {
        const nextCoverUrl = await uploadCover(type, coverImageName, token);
        const nextRecord: RecordItem = {
          title,
          type,
          coverUrl: nextCoverUrl,
          link,
          createdTime,
          rating: parsedRating,
          comment: comment.trim() || undefined,
        };
        const result =
          isEdit && record
            ? await updateRecordAction({
                original: {
                  title: record.title,
                  type: record.type,
                  createdTime: record.createdTime,
                },
                record: nextRecord,
                token,
              })
            : await createRecordAction({ record: nextRecord, token });
        if (!result.success) {
          throw new Error(result.error || 'Save failed');
        }
        return result;
      },
    });
  };

  const handleDelete = () => {
    if (!record) {
      return;
    }
    remove({
      loading: 'Deleting...',
      success: 'Record deleted',
      errorFallback: 'Delete failed',
      onSuccess: () => {
        setConfirmOpen(false);
        onClose();
        router.refresh();
      },
      run: async token => {
        const result = await deleteRecordAction({
          original: { title: record.title, type: record.type, createdTime: record.createdTime },
          token,
        });
        if (!result.success) {
          throw new Error(result.error || 'Delete failed');
        }
      },
    });
  };

  useSaveShortcut(hasToken && !isSaveDisabled, handleSubmit);

  return (
    <Drawer.Root direction="right" open onOpenChange={open => !open && onClose()} handleOnly>
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 z-40"
          style={{ backgroundColor: 'color-mix(in oklch, black 8%, transparent)' }}
        />
        <Drawer.Content
          className="fz-sidepanel fixed inset-y-0 right-0 z-40 max-md:w-full"
          aria-describedby={undefined}
        >
          <Drawer.Title className="sr-only">{isEdit ? 'Edit record' : 'New record'}</Drawer.Title>

          <div className="flex shrink-0 items-center justify-between py-4 pr-4 pl-5">
            <span className="inline-flex items-center gap-[9px] text-[15px] font-semibold">
              <span className="fz-status-dot" data-state="dirty" />
              {isEdit ? 'Edit record' : 'New record'}
            </span>
            <button type="button" className="fz-iconbtn" onClick={onClose} aria-label="Close · Esc">
              <XIcon className="size-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pt-1 pb-5">
            {!hasToken && (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="fz-composer-prompt mb-4"
              >
                <KeyRoundIcon className="size-4" /> Connect a GitHub token to save
              </button>
            )}

            {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone layered over the file-picker button below, which is the keyboard path */}
            <div
              className="fz-cover mx-auto mt-1 mb-[22px] aspect-[2/3] w-[132px]"
              onDragOver={event => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={event => {
                event.preventDefault();
                setIsDragging(false);
                const file = Array.from(event.dataTransfer.files).find(item =>
                  item.type.startsWith('image/'),
                );
                if (file) {
                  stageCoverFile(file);
                }
              }}
            >
              {coverPreviewSrc ? (
                <button
                  type="button"
                  className="block h-full w-full cursor-pointer transition-opacity hover:opacity-85"
                  onClick={() => coverInputRef.current?.click()}
                  aria-label="Change cover image"
                >
                  {/* biome-ignore lint/performance/noImgElement: editor preview of a local blob: URL, not optimizable by next/image */}
                  <img
                    src={coverPreviewSrc}
                    alt={title || 'Cover'}
                    className="fz-cover-img h-full w-full"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  className="fz-cover-empty h-full w-full"
                  data-drag={isDragging || undefined}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <ImagePlusIcon className="size-5" />
                  <span>
                    Drop / paste
                    <br />
                    or browse
                  </span>
                </button>
              )}
            </div>

            {pendingFile && (
              <div className="fz-field-col">
                <span className="fz-field-label">Image name</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <input
                    className="fz-input font-mono text-[13px]"
                    value={coverName ?? title}
                    onChange={event => setCoverName(event.target.value)}
                    placeholder="cover"
                  />
                  <span className="text-muted-foreground/60 truncate font-mono text-[11px]">
                    {buildEditorImageStoragePath({
                      entityId: type,
                      imageId: coverImageName,
                      scope: 'records',
                    })}
                  </span>
                </div>
              </div>
            )}

            <div className="fz-field-col">
              <span className="fz-field-label">Title</span>
              <input
                className="fz-input"
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Title"
              />
            </div>

            <div className="fz-field-col">
              <span className="fz-field-label">Rating</span>
              <div className="flex items-center gap-3">
                <span className="fz-stars">
                  {STAR_POSITIONS.map(star => (
                    <button
                      key={star}
                      type="button"
                      aria-label={`Rate ${star * 2}`}
                      onClick={() => setRating(String(star * 2))}
                    >
                      <StarIcon
                        className="size-[15px]"
                        strokeWidth={1.5}
                        style={{
                          color: star <= ratingStars ? 'oklch(0.74 0.15 75)' : undefined,
                          fill: star <= ratingStars ? 'oklch(0.74 0.15 75)' : 'none',
                        }}
                      />
                    </button>
                  ))}
                </span>
                <input
                  className="fz-input w-12"
                  inputMode="decimal"
                  value={rating}
                  onChange={event => {
                    if (/^\d*(?:\.\d*)?$/.test(event.target.value)) {
                      setRating(event.target.value);
                    }
                  }}
                  placeholder="—"
                />
              </div>
            </div>

            {/* biome-ignore lint/a11y/noStaticElementInteractions: widens the hit area for the native picker; the date input inside is the keyboard path */}
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: same — the input handles keyboard entry natively */}
            <div className="fz-field-col cursor-pointer" onClick={openDatePicker}>
              <span className="fz-field-label">Date</span>
              <input
                ref={dateInputRef}
                className="fz-input font-mono text-[13px] cursor-pointer"
                type="date"
                value={createdTime}
                onChange={event => setCreatedTime(event.target.value)}
              />
            </div>

            <div className="fz-field-col">
              <span className="fz-field-label">Type</span>
              <Segmented
                layoutId="fz-records-type-seg"
                options={typeOptions}
                value={type}
                onChange={setType}
              />
            </div>

            <div className="fz-field-col">
              <span className="fz-field-label">Link</span>
              <input
                className="fz-input font-mono text-[13px]"
                value={link}
                onChange={event => setLink(event.target.value)}
                placeholder="douban.com/subject/…"
              />
            </div>

            <div className="fz-field-col">
              <span className="fz-field-label">Review</span>
              <textarea
                className="fz-textarea"
                value={comment}
                onChange={event => setComment(event.target.value)}
                placeholder="Notes, review, thoughts…"
              />
            </div>
          </div>

          <div className="border-border flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
            {isEdit && (
              <button
                type="button"
                className="fz-iconbtn hover:bg-danger-soft hover:text-danger"
                onClick={() => setConfirmOpen(true)}
                aria-label="Delete record"
                title="Delete"
              >
                <Trash2Icon className="size-[15px]" />
              </button>
            )}
            <span className="flex-1" />
            <button type="button" className="fz-btn fz-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="fz-btn fz-btn-primary"
              onClick={handleSubmit}
              disabled={isSaveDisabled}
              title="Save · ⌘↵"
            >
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>

          <input
            ref={coverInputRef}
            type="file"
            accept={SUPPORTED_IMAGE_TYPES.join(',')}
            className="hidden"
            aria-label="Record cover file"
            onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) {
                stageCoverFile(file);
              }
            }}
          />
        </Drawer.Content>
      </Drawer.Portal>

      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ConfirmDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete record?"
        description="This removes the entry from records.json."
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </Drawer.Root>
  );
}
