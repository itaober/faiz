'use client';

import { ImagePlusIcon, SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
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
      <section className="not-prose mb-6">
        <div className="mb-2 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-9"
            aria-label="Cancel editing"
          >
            <XIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-9"
            aria-label="Settings"
          >
            <SettingsIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaveDisabled}
            className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-9 disabled:cursor-not-allowed"
            aria-label="Save record"
          >
            <SaveIcon className="size-4" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-[8rem_1fr]">
          <div className="space-y-2" onPaste={handleCoverPaste}>
            <div
              tabIndex={0}
              aria-label="Record cover"
              onDrop={handleCoverDrop}
              onDragOver={event => event.preventDefault()}
              className="focus-ring bg-muted relative aspect-[2/3] overflow-hidden rounded-md border"
            >
              {coverPreviewSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={coverPreviewSrc}
                  alt={title || 'Record cover'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-muted-foreground flex h-full items-center justify-center">
                  Cover
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              aria-label="Upload cover"
              className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm transition-colors"
            >
              <ImagePlusIcon className="size-4" />
              {pendingCoverFile ? 'Replace' : 'Upload'}
            </button>
          </div>

          <div className="grid content-start gap-3">
            <input
              name="record-title"
              aria-label="Record title"
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Title"
              className="placeholder:text-muted-foreground bg-transparent text-xl font-bold outline-none"
            />
            <div className="flex flex-wrap gap-2">
              {recordTypes.map(recordType => (
                <button
                  key={recordType}
                  type="button"
                  onClick={() => setType(recordType)}
                  data-active={type === recordType || undefined}
                  className="focus-ring hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground text-muted-foreground rounded-md border px-3 py-1.5 text-sm capitalize transition-colors"
                >
                  {recordType}
                </button>
              ))}
            </div>
            <input
              name="record-cover-url"
              aria-label="Record cover URL"
              value={displayedCoverUrl}
              onChange={event => {
                clearPendingCover();
                setCoverUrl(event.target.value);
              }}
              onPaste={handleCoverPaste}
              placeholder="Cover URL or paste image"
              className="placeholder:text-muted-foreground border-border bg-transparent border-b pb-2 font-mono text-sm outline-none"
            />
            <input
              name="record-link"
              aria-label="Record link"
              value={link}
              onChange={event => setLink(event.target.value)}
              placeholder="Link"
              className="placeholder:text-muted-foreground border-border bg-transparent border-b pb-2 font-mono text-sm outline-none"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="record-created-time"
                aria-label="Record date"
                type="date"
                value={createdTime}
                onChange={event => setCreatedTime(event.target.value)}
                className="border-border bg-transparent border-b pb-2 font-mono text-sm outline-none"
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
                placeholder="Rating"
                className="placeholder:text-muted-foreground border-border bg-transparent border-b pb-2 text-sm outline-none"
              />
            </div>
          </div>
        </div>

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
          minHeightClassName="min-h-64"
          onRequestToken={() => setSettingsOpen(true)}
          onImagesStaged={images => {
            setStagedCommentImages(previousImages => {
              const nextImages = new Map(previousImages.map(image => [image.path, image]));
              images.forEach(image => nextImages.set(image.path, image));
              return Array.from(nextImages.values());
            });
          }}
        />

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
