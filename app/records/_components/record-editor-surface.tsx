'use client';

import { ImagePlusIcon, MessageSquareTextIcon, SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { createRecordAction, updateRecordAction } from '@/app/_actions/edit-content';
import { uploadEditorImageAction } from '@/app/_actions/upload-editor-image';
import { useEditMode } from '@/components/edit-mode-context';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import MarkdownLexicalEditor from '@/components/editing/markdown-lexical-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import type { RecordItem } from '@/lib/data/data';
import {
  buildEditorImageStoragePath,
  type StagedEditorImage,
  toApiImageUrl,
} from '@/lib/utils/editor-image';
import { compressImage, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/utils/image';

const recordTypes: RecordItem['type'][] = ['book', 'movie', 'tv', 'music', 'game'];

interface IRecordEditorSurfaceProps {
  record?: RecordItem;
  onCancel: () => void;
}

const formatDateInput = (value?: string) => {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }
  return value.slice(0, 10);
};

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to encode image'));
        return;
      }
      const base64 = reader.result.split(',')[1];
      if (!base64) {
        reject(new Error('Invalid image data'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

const getClipboardImage = (clipboardData: DataTransfer) => {
  const item = Array.from(clipboardData.items).find(
    clipboardItem => clipboardItem.kind === 'file' && clipboardItem.type.startsWith('image/'),
  );

  return item?.getAsFile() ?? null;
};

const isLikelyImageUrl = (value: string) =>
  /^https?:\/\/\S+/i.test(value.trim()) &&
  (/\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value.trim()) ||
    /(?:image|cover|photo|pic|poster|album)/i.test(value.trim()));

const getClipboardImageUrl = (clipboardData: DataTransfer) => {
  const html = clipboardData.getData('text/html');
  const htmlSrc = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];

  if (htmlSrc && isLikelyImageUrl(htmlSrc)) {
    return htmlSrc;
  }

  const uriList = clipboardData
    .getData('text/uri-list')
    .split('\n')
    .map(line => line.trim())
    .find(line => line && !line.startsWith('#'));

  if (uriList && isLikelyImageUrl(uriList)) {
    return uriList;
  }

  const plainText = clipboardData.getData('text/plain').trim();
  return isLikelyImageUrl(plainText) ? plainText : '';
};

const imageFileNameFromUrl = (url: string, fallbackTitle: string) => {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split('/').filter(Boolean).pop();
    if (filename && /\.[a-z0-9]+$/i.test(filename)) {
      return filename;
    }
  } catch {
    // Fall back to title-based filename below.
  }

  return `${fallbackTitle || 'record-cover'}.jpg`;
};

export default function RecordEditorSurface({ record, onCancel }: IRecordEditorSurfaceProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(record?.title ?? '');
  const [type, setType] = useState<RecordItem['type']>(record?.type ?? 'movie');
  const [coverUrl, setCoverUrl] = useState(record?.coverUrl ?? '');
  const [coverPreviewUrl, setCoverPreviewUrl] = useState('');
  const [pendingCoverFile, setPendingCoverFile] = useState<File | null>(null);
  const [pendingCoverImageId, setPendingCoverImageId] = useState('');
  const [link, setLink] = useState(record?.link ?? '');
  const [createdTime, setCreatedTime] = useState(formatDateInput(record?.createdTime));
  const [rating, setRating] = useState(record?.rating !== undefined ? String(record.rating) : '');
  const [comment, setComment] = useState(record?.comment ?? '');
  const [stagedCommentImages, setStagedCommentImages] = useState<StagedEditorImage[]>([]);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [toolbarPortal, setToolbarPortal] = useState<HTMLElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!record;
  const coverEntityId = `${type}_${title.trim() || 'record-cover'}`;
  const pendingCoverPath =
    pendingCoverFile && pendingCoverImageId
      ? buildEditorImageStoragePath({
          entityId: coverEntityId,
          imageId: pendingCoverImageId,
          scope: 'records',
        })
      : '';
  const displayedCoverUrl = pendingCoverPath ? toApiImageUrl(pendingCoverPath) : coverUrl;
  const coverPreviewSrc = coverPreviewUrl || coverUrl;
  const isSaveDisabled = isSubmitting || !title.trim() || !link.trim() || !displayedCoverUrl.trim();

  const clearPendingCover = useCallback(() => {
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    setCoverPreviewUrl('');
    setPendingCoverFile(null);
    setPendingCoverImageId('');
  }, [coverPreviewUrl]);

  useEffect(() => {
    setTitle(record?.title ?? '');
    setType(record?.type ?? 'movie');
    setCoverUrl(record?.coverUrl ?? '');
    setCoverPreviewUrl('');
    setPendingCoverFile(null);
    setPendingCoverImageId('');
    setLink(record?.link ?? '');
    setCreatedTime(formatDateInput(record?.createdTime));
    setRating(record?.rating !== undefined ? String(record.rating) : '');
    setComment(record?.comment ?? '');
    setStagedCommentImages([]);
    setIsReviewOpen(false);
    setIsDetailsOpen(false);
  }, [record]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  const stageCoverFile = useCallback(
    (file: File) => {
      if (!file) {
        return;
      }

      if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
        toast.error(`Unsupported format: ${file.name}`);
        return;
      }

      if (file.size > MAX_IMAGE_SIZE) {
        toast.error(`File too large: ${file.name}`);
        return;
      }

      clearPendingCover();
      setPendingCoverFile(file);
      setPendingCoverImageId('cover');
      setCoverPreviewUrl(URL.createObjectURL(file));
      toast.success('Cover ready');
    },
    [clearPendingCover],
  );

  const stageCoverUrl = useCallback(
    (url: string) => {
      clearPendingCover();
      setCoverUrl(url);
    },
    [clearPendingCover],
  );

  const stageCoverFromUrl = useCallback(
    async (url: string) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Remote image is not readable');
        }

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
          throw new Error('Remote URL is not an image');
        }

        const file = new File([blob], imageFileNameFromUrl(url, title), { type: blob.type });
        stageCoverFile(file);
      } catch {
        stageCoverUrl(url);
        toast.success('Cover URL set');
      }
    },
    [stageCoverFile, stageCoverUrl, title],
  );

  const handleCoverSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    stageCoverFile(file);
  };

  const handleCoverPaste = async (event: React.ClipboardEvent) => {
    const file = getClipboardImage(event.clipboardData);
    if (file) {
      event.preventDefault();
      stageCoverFile(file);
      return;
    }

    const imageUrl = getClipboardImageUrl(event.clipboardData);
    if (!imageUrl) {
      return;
    }
    event.preventDefault();
    await stageCoverFromUrl(imageUrl);
  };

  const handleCoverDrop = async (event: React.DragEvent) => {
    const file = Array.from(event.dataTransfer.files).find(item => item.type.startsWith('image/'));
    if (!file) {
      return;
    }

    event.preventDefault();
    stageCoverFile(file);
  };

  const uploadPendingCover = async () => {
    if (!pendingCoverFile || !pendingCoverImageId) {
      return coverUrl;
    }

    const compressed = await compressImage(pendingCoverFile);
    const imageBase64 = await fileToBase64(compressed);
    const result = await uploadEditorImageAction({
      imageBase64,
      mimeType: 'image/webp',
      scope: 'records',
      entityId: coverEntityId,
      imageId: pendingCoverImageId,
      token: token || '',
      revalidate: '/records',
    });

    if (!result.success || !result.data) {
      throw new Error(result.success ? 'Upload failed' : result.error);
    }

    return toApiImageUrl(result.data);
  };

  const handleSubmit = async () => {
    if (!token) {
      setSettingsOpen(true);
      return;
    }

    setIsSubmitting(true);
    const saveRecord = async () => {
      const nextCoverUrl = await uploadPendingCover();
      await uploadStagedEditorImages({
        images: stagedCommentImages,
        content: comment,
        token,
        revalidatePath: '/records',
      });

      const nextRecord: RecordItem = {
        title,
        type,
        coverUrl: nextCoverUrl,
        link,
        createdTime,
        rating: rating.trim() ? Number(rating) : undefined,
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
    };

    toast.promise(saveRecord(), {
      loading: pendingCoverFile ? 'Uploading cover...' : isEdit ? 'Updating...' : 'Saving...',
      success: () => {
        clearPendingCover();
        setStagedCommentImages([]);
        onCancel();
        router.refresh();
        return isEdit ? 'Record updated' : 'Record saved';
      },
      error: error => error.message || 'Save failed',
      finally: () => setIsSubmitting(false),
    });
  };

  return (
    <>
      <section className="not-prose relative min-w-0">
        <div className="bg-background/80 border-border/80 absolute top-2 right-2 z-20 flex items-center gap-0.5 rounded-full border p-0.5 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-8"
            aria-label="Cancel editing"
          >
            <XIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setIsReviewOpen(false);
              setIsDetailsOpen(open => !open);
            }}
            data-active={isDetailsOpen || undefined}
            className="focus-ring icon-button hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground text-muted-foreground hover:text-foreground size-8"
            aria-label="Record details"
          >
            <SettingsIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaveDisabled}
            className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-8 disabled:cursor-not-allowed"
            aria-label="Save record"
          >
            <SaveIcon className="size-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="relative" onPaste={handleCoverPaste}>
            <div
              tabIndex={0}
              aria-label="Record cover"
              onDrop={handleCoverDrop}
              onDragOver={event => event.preventDefault()}
              className="focus-ring bg-muted/50 border-border/70 relative overflow-hidden rounded-md border"
            >
              {coverPreviewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreviewSrc}
                  alt={title || 'Record cover'}
                  className={`relative w-full rounded object-cover ${
                    type === 'music' ? 'aspect-square' : 'aspect-[2/3]'
                  }`}
                />
              ) : (
                <div
                  className={`text-muted-foreground flex w-full items-center justify-center ${
                    type === 'music' ? 'aspect-square' : 'aspect-[2/3]'
                  }`}
                >
                  Cover
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              aria-label="Upload cover"
              className="focus-ring bg-background/90 hover:bg-background text-muted-foreground hover:text-foreground absolute bottom-2 left-2 flex size-8 items-center justify-center rounded-md border shadow-sm backdrop-blur transition-colors"
            >
              <ImagePlusIcon className="size-4" />
            </button>
          </div>

          <input
            name="record-title"
            aria-label="Record title"
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="Title"
            className="placeholder:text-muted-foreground truncate bg-transparent text-sm font-medium leading-5 outline-none"
          />

          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5">
            <select
              name="record-type"
              aria-label="Record type"
              value={type}
              onChange={event => setType(event.target.value as RecordItem['type'])}
              className="border-border/70 bg-background/70 focus:border-foreground/40 min-w-0 rounded-md border px-2 py-1.5 text-xs capitalize outline-none"
            >
              {recordTypes.map(recordType => (
                <option key={recordType} value={recordType}>
                  {recordType}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setIsDetailsOpen(false);
                setIsReviewOpen(open => !open);
              }}
              data-active={isReviewOpen || undefined}
              className="focus-ring hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground text-muted-foreground hover:text-foreground flex h-8 items-center gap-1.5 rounded-md border border-transparent px-2 text-xs transition-colors"
            >
              <MessageSquareTextIcon className="size-3.5" />
              Review
            </button>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_3.25rem] gap-1.5">
            <input
              name="record-created-time"
              aria-label="Record date"
              type="date"
              value={createdTime}
              onChange={event => setCreatedTime(event.target.value)}
              className="border-border bg-transparent border-b pb-1 font-mono text-[11px] outline-none"
            />
            <input
              name="record-rating"
              aria-label="Record rating"
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={rating}
              onChange={event => setRating(event.target.value)}
              placeholder="Rate"
              className="placeholder:text-muted-foreground border-border bg-transparent border-b pb-1 text-[11px] outline-none"
            />
          </div>
        </div>

        {isDetailsOpen ? (
          <div className="bg-background border-border absolute top-11 right-0 z-30 w-[min(20rem,calc(100vw-2rem))] rounded-lg border p-3 shadow-xl max-md:fixed max-md:inset-x-3 max-md:top-auto max-md:bottom-3 max-md:w-auto">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs font-medium">Record details</p>
              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-7"
                aria-label="Close record details"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <label className="mb-3 block">
              <span className="text-muted-foreground mb-1 block text-xs">Cover URL</span>
              <input
                name="record-cover-url"
                aria-label="Record cover URL"
                value={displayedCoverUrl}
                onChange={event => {
                  clearPendingCover();
                  setCoverUrl(event.target.value);
                }}
                onPaste={handleCoverPaste}
                placeholder="Paste cover URL"
                className="border-border placeholder:text-muted-foreground focus:border-foreground/40 w-full rounded-md border bg-transparent px-2.5 py-2 font-mono text-xs outline-none"
              />
            </label>
            <label className="mb-3 block">
              <span className="text-muted-foreground mb-1 block text-xs">Link</span>
              <input
                name="record-link"
                aria-label="Record link"
                value={link}
                onChange={event => setLink(event.target.value)}
                placeholder="Paste source link"
                className="border-border placeholder:text-muted-foreground focus:border-foreground/40 w-full rounded-md border bg-transparent px-2.5 py-2 font-mono text-xs outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 items-center rounded-md px-2 text-xs transition-colors"
            >
              GitHub token settings
            </button>
          </div>
        ) : null}

        {isReviewOpen ? (
          <div className="bg-background border-border absolute top-0 left-1/2 z-40 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 rounded-lg border shadow-xl max-md:fixed max-md:inset-x-3 max-md:top-auto max-md:bottom-3 max-md:w-auto max-md:translate-x-0 md:w-[28rem]">
            <div className="border-border flex items-center gap-2 border-b p-2">
              <p className="text-muted-foreground px-1 text-xs font-medium">Review</p>
              <div ref={setToolbarPortal} className="ml-auto flex shrink-0" />
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-8 shrink-0"
                aria-label="Close review"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            <div className="max-h-[55vh] overflow-auto p-3">
              <MarkdownLexicalEditor
                key={`${record?.title ?? 'new-record'}-${record?.createdTime ?? 'draft'}`}
                value={comment}
                onChange={setComment}
                token={token}
                uploadScope="records"
                uploadEntityId={title || 'record-comment'}
                revalidatePath="/records"
                placeholder="Notes, review, thoughts..."
                chrome="seamless"
                showQuickReference={false}
                showMobileToolbarOverlay={false}
                toolbarPortal={toolbarPortal}
                minHeightClassName="min-h-48"
                onRequestToken={() => setSettingsOpen(true)}
                onImagesStaged={images => {
                  setStagedCommentImages(previousImages => {
                    const nextImages = new Map(previousImages.map(image => [image.path, image]));
                    images.forEach(image => nextImages.set(image.path, image));
                    return Array.from(nextImages.values());
                  });
                }}
              />
            </div>
          </div>
        ) : null}

        <input
          ref={coverInputRef}
          name="record-cover-file"
          aria-label="Record cover file"
          type="file"
          accept={SUPPORTED_IMAGE_TYPES.join(',')}
          className="hidden"
          onChange={handleCoverSelect}
        />
      </section>

      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
