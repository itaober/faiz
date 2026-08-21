'use client';

import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { createMemoAction } from '@/app/memos/_actions/create-memo';
import { deleteMemoAction } from '@/app/memos/_actions/delete-memo';
import { updateMemoAction } from '@/app/memos/_actions/update-memo';
import type { ActionBarTool, EditViewMode } from '@/components/editing/action-bar';
import ConfirmDrawer from '@/components/editing/confirm-drawer';
import { useDockedActionBar } from '@/components/editing/edit-session';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import TiptapEditor from '@/components/editing/tiptap-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import { useContentEditor } from '@/hooks/use-content-editor';
import type { Memo } from '@/lib/data/memos';
import type { StagedEditorImage } from '@/lib/utils/editor-image';
import { mergeByPath, toApiImageUrl } from '@/lib/utils/editor-image';

import { useMemosContext } from '../_context/use-memos-context';

interface IMemoEditorSurfaceProps {
  memo?: Memo;
  onCancel: () => void;
}

interface MemoAttachment {
  alt: string;
  id: string;
  path: string;
  pending?: StagedEditorImage;
  previewSrc: string;
}

const toExistingAttachment = (path: string): MemoAttachment => ({
  alt: 'Memo attachment',
  id: path,
  path,
  previewSrc: toApiImageUrl(path),
});

const generateMemoDraftId = () =>
  `memo_${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

export default function MemoEditorSurface({ memo, onCancel }: IMemoEditorSurfaceProps) {
  const router = useRouter();
  const { token } = useMemosContext();
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
  } = useContentEditor(token);
  const [draftId, setDraftId] = useState(generateMemoDraftId);
  const [imageUploadRequestId, setImageUploadRequestId] = useState(0);

  const isEditMode = !!memo;
  const hasToken = !!token;
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
    // Validate only once a token exists, so a token-less save still routes to the
    // connect-token drawer first (matching the prior gate ordering).
    if (hasToken && !content.trim() && attachments.length === 0) {
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
      run: async token => {
        await uploadStagedEditorImages({
          images: attachments.flatMap(attachment =>
            attachment.pending ? [attachment.pending] : [],
          ),
          token,
          revalidatePath: '/memos',
        });

        const imagePaths = attachments.map(attachment => attachment.path);
        const result =
          isEditMode && memo
            ? await updateMemoAction({
                id: memo.id,
                content: content.trim(),
                images: imagePaths,
                createdTime: memo.createdTime,
                token,
              })
            : await createMemoAction({
                id: draftId,
                content: content.trim(),
                images: imagePaths,
                token,
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
      run: async token => {
        const result = await deleteMemoAction({
          id: memo.id,
          createdTime: memo.createdTime,
          token,
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

  // Image grid mirrors the read view (3-col, aspect-square) with a remove control
  // on each image + a dashed add box — same layout/size as how memos display.
  const imagesFooter = (
    <div className="not-prose grid grid-cols-3 gap-2 pb-4 md:gap-4">
      {attachments.map(attachment => (
        <div
          key={attachment.id}
          className="group bg-muted/30 relative aspect-square overflow-hidden rounded-md"
        >
          {/* biome-ignore lint/performance/noImgElement: editor preview of a local blob: URL, not optimizable by next/image */}
          <img
            src={attachment.previewSrc}
            alt={attachment.alt}
            className="size-full object-cover"
          />
          {attachment.pending ? (
            <span className="bg-foreground/70 absolute bottom-2 left-2 size-1.5 rounded-full" />
          ) : null}
          <button
            type="button"
            onClick={() =>
              setAttachments(images => images.filter(image => image.id !== attachment.id))
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
        className="fz-cover-empty aspect-square w-full"
        aria-label="Add image"
      >
        <PlusIcon className="size-5" />
      </button>
    </div>
  );

  useDockedActionBar({
    context: isEditMode ? 'Memo' : 'New memo',
    status: isSubmitting ? 'saving' : 'dirty',
    hasToken,
    onConnect: () => setIsSettingsOpen(true),
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
            mergeByPath(previous, images, image => ({
              alt: image.alt,
              id: image.path,
              path: image.path,
              pending: image,
              previewSrc: image.previewSrc,
            })),
          )
        }
      />

      <GitHubTokenDrawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      <ConfirmDrawer
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
