'use client';

import { PencilIcon, SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { updatePageAction } from '@/app/_actions/edit-content';
import { useEditMode } from '@/components/edit-mode-context';
import { hasEditorFloatingLayer } from '@/components/editing/editor-floating-layer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import MarkdownLexicalEditor from '@/components/editing/markdown-lexical-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IPageMdxActionsProps {
  page: 'about' | 'lines';
  title: string;
  content: string;
}

export default function PageMdxActions({ page, title, content }: IPageMdxActionsProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftContent, setDraftContent] = useState(content);
  const [stagedImages, setStagedImages] = useState<StagedEditorImage[]>([]);
  const isSaveDisabled = isSubmitting || !draftTitle.trim();

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraftTitle(title);
    setDraftContent(content);
    setStagedImages([]);
  }, [content, open, title]);

  const handleSubmit = async () => {
    if (!token) {
      setSettingsOpen(true);
      return;
    }

    setIsSubmitting(true);
    const savePage = async () => {
      await uploadStagedEditorImages({
        images: stagedImages,
        content: draftContent,
        token,
        revalidatePath: page === 'about' ? '/' : `/${page}`,
      });

      const result = await updatePageAction({
        page,
        title: draftTitle,
        content: draftContent,
        token,
      });
      if (!result.success) {
        throw new Error(result.error || 'Save failed');
      }
      return result;
    };

    toast.promise(savePage(), {
      loading: 'Saving...',
      success: () => {
        setStagedImages([]);
        setOpen(false);
        router.refresh();
        return 'Page saved';
      },
      error: error => error.message || 'Save failed',
      finally: () => setIsSubmitting(false),
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={event => {
          event.currentTarget.blur();
          setOpen(true);
        }}
        className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
        aria-label={`Edit ${page}`}
      >
        <PencilIcon className="size-4" />
      </button>

      <Drawer.Root direction="right" open={open} onOpenChange={setOpen} handleOnly>
        <Drawer.Portal>
          <Drawer.Overlay className="bg-overlay-backdrop fixed inset-0 z-20" />
          <Drawer.Content
            onEscapeKeyDown={event => {
              if (hasEditorFloatingLayer()) {
                event.preventDefault();
              }
            }}
            className="bg-background border-border fixed top-0 right-0 bottom-0 z-20 flex w-[100vw] max-w-3xl flex-col outline-none md:rounded-l-xl md:border"
          >
            <Drawer.Title className="sr-only">Edit {page}</Drawer.Title>
            <Drawer.Description className="sr-only">
              Edit this page title and Markdown content.
            </Drawer.Description>
            <div className="flex items-center justify-between p-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
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
                    setSettingsOpen(true);
                  }}
                  className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-11"
                  aria-label="Settings"
                >
                  <SettingsIcon className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={async event => {
                    event.currentTarget.blur();
                    await handleSubmit();
                  }}
                  disabled={isSaveDisabled}
                  className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-11 disabled:cursor-not-allowed"
                  aria-label="Save page"
                >
                  <SaveIcon className="size-6" />
                </button>
              </div>
            </div>

            <div className="border-border border-b px-4 pb-4">
              <input
                name={`${page}-title`}
                aria-label="Page title"
                value={draftTitle}
                onChange={event => setDraftTitle(event.target.value)}
                placeholder="Page title"
                className="placeholder:text-muted-foreground w-full bg-transparent text-2xl font-bold outline-none"
              />
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <MarkdownLexicalEditor
                key={`${page}-${open}`}
                value={draftContent}
                onChange={setDraftContent}
                token={token}
                uploadScope="pages"
                uploadEntityId={page}
                revalidatePath={page === 'about' ? '/' : `/${page}`}
                placeholder="Edit this page..."
                minHeightClassName="min-h-[62vh]"
                onRequestToken={() => setSettingsOpen(true)}
                onImagesStaged={images => {
                  setStagedImages(previousImages => {
                    const nextImages = new Map(previousImages.map(image => [image.path, image]));
                    images.forEach(image => nextImages.set(image.path, image));
                    return Array.from(nextImages.values());
                  });
                }}
              />
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
