'use client';

import { SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { updatePageAction } from '@/app/_actions/edit-content';
import { useEditMode } from '@/components/edit-mode-context';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import MarkdownLexicalEditor from '@/components/editing/markdown-lexical-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IPageMdxEditorSurfaceProps {
  page: 'about' | 'lines';
  title: string;
  content: string;
  onCancel: () => void;
}

export default function PageMdxEditorSurface({
  page,
  title,
  content,
  onCancel,
}: IPageMdxEditorSurfaceProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftContent, setDraftContent] = useState(content);
  const [stagedImages, setStagedImages] = useState<StagedEditorImage[]>([]);
  const isSaveDisabled = isSubmitting || !draftTitle.trim();

  useEffect(() => {
    setDraftTitle(title);
    setDraftContent(content);
    setStagedImages([]);
  }, [content, title]);

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
        onCancel();
        router.refresh();
        return 'Page saved';
      },
      error: error => error.message || 'Save failed',
      finally: () => setIsSubmitting(false),
    });
  };

  return (
    <>
      <section className="not-prose bg-background/95 border-border mb-8 overflow-hidden rounded-lg border">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <p className="text-muted-foreground text-sm">Editing {page}</p>
          <div className="flex items-center gap-1">
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
              aria-label="Save page"
            >
              <SaveIcon className="size-4" />
            </button>
          </div>
        </div>

        <div className="border-border border-b px-4 py-4">
          <input
            name={`${page}-title`}
            aria-label="Page title"
            value={draftTitle}
            onChange={event => setDraftTitle(event.target.value)}
            placeholder="Page title"
            className="placeholder:text-muted-foreground w-full bg-transparent text-4xl font-bold tracking-tight outline-none"
          />
        </div>

        <MarkdownLexicalEditor
          key={page}
          value={draftContent}
          onChange={setDraftContent}
          token={token}
          uploadScope="pages"
          uploadEntityId={page}
          revalidatePath={page === 'about' ? '/' : `/${page}`}
          placeholder="Edit this page..."
          minHeightClassName="min-h-[48vh]"
          onRequestToken={() => setSettingsOpen(true)}
          onImagesStaged={images => {
            setStagedImages(previousImages => {
              const nextImages = new Map(previousImages.map(image => [image.path, image]));
              images.forEach(image => nextImages.set(image.path, image));
              return Array.from(nextImages.values());
            });
          }}
        />
      </section>

      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
