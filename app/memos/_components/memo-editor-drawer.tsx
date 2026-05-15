'use client';

import { SaveIcon, Settings, Trash2Icon, XIcon } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { createMemoAction } from '@/app/memos/_actions/create-memo';
import { updateMemoAction } from '@/app/memos/_actions/update-memo';
import { hasEditorFloatingLayer } from '@/components/editing/editor-floating-layer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import MarkdownLexicalEditor from '@/components/editing/markdown-lexical-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import { generateId } from '@/lib/data/common';
import type { Memo } from '@/lib/data/memos';
import type { StagedEditorImage } from '@/lib/utils/editor-image';
import { toApiImageUrl, updateStagedEditorImageCaption } from '@/lib/utils/editor-image';

import { useMemosContext } from '../_context/use-memos-context';

interface MemosEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memo?: Memo;
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

export default function MemosEditorDrawer({ open, onOpenChange, memo }: MemosEditorDrawerProps) {
  const router = useRouter();
  const { token } = useMemosContext();
  const [content, setContent] = useState(memo?.content ?? '');
  const [attachments, setAttachments] = useState<MemoAttachment[]>(() =>
    memo ? memo.images.map(toExistingAttachment) : [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draftId, setDraftId] = useState(() => generateId('memo'));

  const isEditMode = !!memo;
  const entityId = memo?.id || draftId;

  useEffect(() => {
    if (open && memo) {
      setContent(memo.content);
      setAttachments(memo.images.map(toExistingAttachment));
      return;
    }

    if (open && !memo) {
      setDraftId(generateId('memo'));
      setContent('');
      setAttachments([]);
      return;
    }

    if (!open) {
      setContent('');
      setAttachments([]);
    }
  }, [memo, open]);

  const handleSubmit = async () => {
    if (!token) {
      setIsSettingsOpen(true);
      return;
    }

    if (!content.trim() && attachments.length === 0) {
      toast.error('Please enter content or upload images');
      return;
    }

    setIsSubmitting(true);

    const submitMemo = async () => {
      await uploadStagedEditorImages({
        images: attachments.flatMap(attachment => (attachment.pending ? [attachment.pending] : [])),
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
    };

    toast.promise(submitMemo(), {
      loading: attachments.some(attachment => attachment.pending)
        ? 'Uploading images...'
        : isEditMode
          ? 'Updating...'
          : 'Publishing...',
      success: () => {
        setContent('');
        setAttachments([]);
        onOpenChange(false);
        router.refresh();
        return isEditMode ? 'Memo updated' : 'Memo published';
      },
      error: error => error.message || 'Operation failed',
      finally: () => setIsSubmitting(false),
    });
  };

  const updateAttachmentCaption = (attachmentId: string, caption: string) => {
    setAttachments(previousAttachments =>
      previousAttachments.map(attachment => {
        if (attachment.id !== attachmentId) {
          return attachment;
        }

        const alt = caption.trim();
        if (!attachment.pending) {
          return { ...attachment, alt };
        }

        const imageId = alt || attachment.pending.imageId || 'image';
        let pending = updateStagedEditorImageCaption(attachment.pending, alt, imageId);
        let suffix = 2;

        while (
          previousAttachments.some(
            otherAttachment =>
              otherAttachment.id !== attachment.id && otherAttachment.path === pending.path,
          )
        ) {
          pending = updateStagedEditorImageCaption(attachment.pending, alt, `${imageId}-${suffix}`);
          suffix += 1;
        }

        return {
          ...attachment,
          alt: pending.alt,
          path: pending.path,
          pending,
        };
      }),
    );
  };

  const isDisabled = isSubmitting || (!content.trim() && attachments.length === 0);
  const attachmentsFooter =
    attachments.length > 0 ? (
      <section className="bg-background px-4 pt-4 pb-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-medium">
            Attached images · {attachments.length}
          </p>
          <p className="text-muted-foreground/70 text-[11px]">Uploads on save</p>
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {attachments.map(attachment => (
            <div key={attachment.id} className="group space-y-2">
              <div className="bg-muted/20 relative overflow-hidden rounded-lg">
                {attachment.previewSrc.startsWith('data:') ||
                attachment.previewSrc.startsWith('blob:') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={attachment.previewSrc}
                    alt={attachment.alt}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <Image
                    src={attachment.previewSrc}
                    alt={attachment.alt}
                    width={180}
                    height={180}
                    className="aspect-square w-full object-cover"
                  />
                )}
                {attachment.pending ? (
                  <span className="bg-background/90 text-muted-foreground absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[10px] shadow-sm">
                    Pending
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setAttachments(images => images.filter(image => image.id !== attachment.id))
                  }
                  className="focus-ring bg-background/90 text-danger absolute top-1.5 right-1.5 flex size-7 items-center justify-center rounded-full opacity-100 shadow-sm md:opacity-0 md:group-hover:opacity-100"
                  aria-label="Remove attached image"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
              {attachment.pending ? (
                <input
                  type="text"
                  aria-label="Attachment caption"
                  value={attachment.alt}
                  onChange={event => updateAttachmentCaption(attachment.id, event.target.value)}
                  placeholder="Image caption"
                  className="placeholder:text-muted-foreground/60 focus:border-foreground/40 w-full border-b border-transparent bg-transparent px-1 pb-1 text-xs outline-none transition-colors"
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <>
      <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange} handleOnly>
        <Drawer.Portal>
          <Drawer.Overlay className="bg-overlay-backdrop fixed inset-0 z-20" />
          <Drawer.Content
            onEscapeKeyDown={event => {
              if (hasEditorFloatingLayer()) {
                event.preventDefault();
              }
            }}
            className="bg-background md:border-r-none md:border-border md:dark:border-border fixed top-0 right-0 bottom-0 z-20 flex w-[100vw] max-w-2xl flex-col outline-none md:rounded-l-xl md:border"
          >
            <Drawer.Title className="sr-only">{isEditMode ? 'Edit Memo' : 'New Memo'}</Drawer.Title>
            <Drawer.Description className="sr-only">
              Compose memo content with the shared Markdown editor.
            </Drawer.Description>

            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-11"
                aria-label="Close editor"
              >
                <XIcon className="size-6" />
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={event => {
                    event.currentTarget.blur();
                    setIsSettingsOpen(true);
                  }}
                  className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-11"
                  aria-label="Settings"
                >
                  <Settings className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={async event => {
                    event.currentTarget.blur();
                    await handleSubmit();
                  }}
                  disabled={isDisabled}
                  className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-11 disabled:cursor-not-allowed"
                  aria-label={isEditMode ? 'Update' : 'Publish'}
                >
                  <SaveIcon className="size-6" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <MarkdownLexicalEditor
                key={entityId}
                value={content}
                onChange={setContent}
                token={token}
                uploadScope="memos"
                uploadEntityId={entityId}
                revalidatePath="/memos"
                placeholder="Write something..."
                minHeightClassName="min-h-[52vh]"
                onRequestToken={() => setIsSettingsOpen(true)}
                insertUploadedImages={false}
                editorFooter={attachmentsFooter}
                onImagesStaged={images => {
                  setAttachments(previousAttachments => {
                    const nextAttachments = new Map(
                      previousAttachments.map(attachment => [attachment.path, attachment]),
                    );

                    images.forEach(image => {
                      nextAttachments.set(image.path, {
                        alt: image.alt,
                        id: image.path,
                        path: image.path,
                        pending: image,
                        previewSrc: image.previewSrc,
                      });
                    });

                    return Array.from(nextAttachments.values());
                  });
                }}
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <GitHubTokenDrawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
