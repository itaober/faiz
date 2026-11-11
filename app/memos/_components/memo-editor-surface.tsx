'use client';

import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { createMemoAction } from '@/app/memos/_actions/create-memo';
import { deleteMemoAction } from '@/app/memos/_actions/delete-memo';
import { updateMemoAction } from '@/app/memos/_actions/update-memo';
import { useEditMode } from '@/components/edit-mode-context';
import type { ActionBarTool, EditViewMode } from '@/components/editing/action-bar';
import ConfirmDialog from '@/components/editing/confirm-dialog';
import EditKeyDrawer from '@/components/editing/edit-key-drawer';
import { useDockedActionBar } from '@/components/editing/edit-session';
import { resolveEditorImageSrc } from '@/components/editing/tiptap/image-preview-store';
import TiptapEditor from '@/components/editing/tiptap-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import { useContentEditor } from '@/hooks/use-content-editor';
import type { Memo } from '@/lib/data/memos';
import type { StagedEditorImage } from '@/lib/utils/editor-image';
import { mergeByKey } from '@/lib/utils/editor-image';

interface IMemoEditorSurfaceProps {
  memo?: Memo;
  onCancel: () => void;
}

interface MemoAttachment {
  alt: string;
  /** Asset key stored in the memo's `images`. */
  key: string;
  pending?: StagedEditorImage;
}

const toExistingAttachment = (key: string): MemoAttachment => ({
  alt: 'Memo attachment',
  key,
});

const generateMemoDraftId = () =>
  `memo_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export default function MemoEditorSurface({ memo, onCancel }: IMemoEditorSurfaceProps) {
  const router = useRouter();
  const { isSignedIn } = useEditMode();
  const [mode, setMode] = useState<EditViewMode>('wysiwyg');
  const [content, setContent] = useState(memo?.content ?? '');
  const [attachments, setAttachments] = useState<MemoAttachment[]>(() =>
    memo ? memo.images.map(toExistingAttachment) : [],
  );
  const {
    settingsOpen: isSettingsOpen,
    setSettingsOpen: setIsSettingsOpen,
    confirmOpen: isDeleteOpen,
    setConfirmOpen: setIsDeleteOpen,
    isSubmitting,
    isDeleting,
    submit,
    remove,
  } = useContentEditor(isSignedIn);
  const [draftId, setDraftId] = useState(generateMemoDraftId);
  const [imageUploadRequestId, setImageUploadRequestId] = useState(0);

  const isEditMode = !!memo;
  const entityId = memo?.id || draftId;

  useEffect(() => {
    if (memo) {
      setContent(memo.content);
      setAttachments(memo.images.map(toExistingAttachment));
      return;
    }
    setDraftId(generateMemoDraftId());
    setContent('');
    setAttachments([]);
  }, [memo]);

  const handleSubmit = () => {
    // Validate only once signed in, so a signed-out save still routes to the
    // edit-key drawer first.
    if (isSignedIn && !content.trim() && attachments.length === 0) {
      toast.error('Please enter content or upload images');
      return;
    }
    submit({
      loading: attachments.some(attachment => attachment.pending)
        ? 'Uploading images...'
        : isEditMode
          ? 'Updating...'
          : 'Publishing...',
      success: isEditMode ? 'Memo updated' : 'Memo published',
      errorFallback: 'Operation failed',
      onSuccess: () => {
        setContent('');
        setAttachments([]);
        onCancel();
        router.refresh();
      },
      run: async () => {
        await uploadStagedEditorImages({
          images: attachments.flatMap(attachment =>
            attachment.pending ? [attachment.pending] : [],
          ),
        });

        const imageKeys = attachments.map(attachment => attachment.key);
        const result =
          isEditMode && memo
            ? await updateMemoAction({
                id: memo.id,
                content: content.trim(),
                images: imageKeys,
                createdTime: memo.createdTime,
              })
            : await createMemoAction({
                id: draftId,
                content: content.trim(),
                images: imageKeys,
              });
        if (!result.success) {
          throw new Error(result.error || 'Operation failed');
        }
        return result;
      },
    });
  };

  const handleDelete = () => {
    if (!memo) {
      return;
    }
    remove({
      loading: 'Deleting...',
      success: 'Memo deleted',
      errorFallback: 'Delete failed',
      onSuccess: () => {
        setIsDeleteOpen(false);
        onCancel();
        router.refresh();
      },
      run: async () => {
        const result = await deleteMemoAction({
          id: memo.id,
          createdTime: memo.createdTime,
        });
        if (!result.success) {
          throw new Error(result.error || 'Delete failed');
        }
      },
    });
  };

  const isDisabled = isSubmitting || (!content.trim() && attachments.length === 0);
  const tools: ActionBarTool[] = isEditMode
    ? [
        {
          icon: Trash2Icon,
          label: 'Delete memo',
          danger: true,
          onClick: () => setIsDeleteOpen(true),
        },
      ]
    : [];

  // Attachment strip, shown only once something is attached: images already get
  // in via /image, the mobile toolbar, paste and drop, so an empty tray would
  // just take space. Thumbnails stay compact — the read view sizes the real grid.
  const imagesFooter = attachments.length ? (
    <div className="not-prose flex flex-wrap gap-2 pb-4">
      {attachments.map(attachment => (
        <div
          key={attachment.key}
          className="group bg-muted/30 relative size-24 overflow-hidden rounded-md"
        >
          {/* biome-ignore lint/performance/noImgElement: editor preview; src may be a local blob: URL, which next/image cannot optimize */}
          <img
            src={resolveEditorImageSrc(attachment.key)}
            alt={attachment.alt}
            className="size-full object-cover"
          />
          {attachment.pending ? (
            <span className="bg-foreground/70 absolute bottom-2 left-2 size-1.5 rounded-full" />
          ) : null}
          <button
            type="button"
            onClick={() =>
              setAttachments(images => images.filter(image => image.key !== attachment.key))
            }
            className="focus-ring bg-background/90 text-danger absolute top-2 right-2 flex size-6 items-center justify-center rounded-full opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-hover:opacity-100"
            aria-label="Remove image"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => setImageUploadRequestId(requestId => requestId + 1)}
        className="fz-cover-empty size-24"
        aria-label="Add image"
      >
        <PlusIcon className="size-5" />
      </button>
    </div>
  ) : null;

  useDockedActionBar({
    context: isEditMode ? 'Memo' : 'New memo',
    status: isSubmitting ? 'saving' : 'dirty',
    isSignedIn,
    onSignIn: () => setIsSettingsOpen(true),
    mode,
    onModeChange: setMode,
    tools,
    onExit: onCancel,
    onSave: handleSubmit,
    saveLabel: isEditMode ? 'Save' : 'Publish',
    saveDisabled: isDisabled,
  });

  return (
    <section className="not-prose">
      <TiptapEditor
        key={entityId}
        value={content}
        onChange={setContent}
        mode={mode}
        uploadScope="memos"
        uploadEntityId={entityId}
        placeholder="Write something..."
        imageUploadRequestId={imageUploadRequestId}
        editorClassName="memo-editor-content"
        minHeightClassName="min-h-0"
        insertUploadedImages={false}
        editorFooter={imagesFooter}
        autoFocus
        onImagesStaged={images =>
          setAttachments(previous =>
            mergeByKey(previous, images, image => ({
              alt: image.alt,
              key: image.key,
              pending: image,
            })),
          )
        }
      />

      <EditKeyDrawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete memo?"
        description="This memo will be permanently removed."
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </section>
  );
}
