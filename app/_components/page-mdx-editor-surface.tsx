'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useEditMode } from '@/components/edit-mode-context';
import type { EditViewMode } from '@/components/editing/action-bar';
import EditKeyDrawer from '@/components/editing/edit-key-drawer';
import { useDockedActionBar } from '@/components/editing/edit-session';
import TiptapEditor from '@/components/editing/tiptap-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import { useContentEditor } from '@/hooks/use-content-editor';
import { isMobileViewport } from '@/hooks/use-is-mobile';
import { type IPageSaveResult, updatePageAction } from '@/lib/actions/edit-page';
import type { EditablePage } from '@/lib/content-editing-validation';
import { markdownTodoListsToMdx, mdxToEditorMarkdown } from '@/lib/mdx-editing';
import { cn } from '@/lib/utils';
import { mergeByKey, type StagedEditorImage } from '@/lib/utils/editor-image';

import PostTitle from './post-title';

interface IPageMdxEditorSurfaceProps {
  page: EditablePage;
  title: string;
  initialContent: string;
  /** Revision the body came from; sent back on save so a concurrent edit conflicts. */
  revision?: string;
}

export default function PageMdxEditorSurface({
  page,
  title,
  initialContent,
  revision,
}: IPageMdxEditorSurfaceProps) {
  const router = useRouter();
  const { isSignedIn, setEditMode } = useEditMode();
  // Touch enters edit directly (tap-to-edit); desktop opens in preview.
  const [mode, setMode] = useState<EditViewMode>(() =>
    isMobileViewport() ? 'wysiwyg' : 'preview',
  );
  const { settingsOpen, setSettingsOpen, isSubmitting, submit } = useContentEditor(isSignedIn);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftContent, setDraftContent] = useState(() => mdxToEditorMarkdown(initialContent));
  const [contentRevision, setContentRevision] = useState(revision);
  const [stagedImages, setStagedImages] = useState<StagedEditorImage[]>([]);
  const context = page === 'about' ? 'About' : 'Lines';
  const isSaveDisabled = isSubmitting || !draftTitle.trim();
  const readOnlyTitle = mode === 'preview';

  useEffect(() => {
    setDraftTitle(title);
    setDraftContent(mdxToEditorMarkdown(initialContent));
    setContentRevision(revision);
    setStagedImages([]);
  }, [initialContent, revision, title]);

  const handleSubmit = () => {
    submit<IPageSaveResult | undefined>({
      loading: 'Saving...',
      success: 'Page saved',
      errorFallback: 'Save failed',
      onSuccess: saved => {
        setStagedImages([]);
        setMode('preview');
        // Adopt the revision we just wrote so a second save isn't a conflict.
        setContentRevision(saved?.revision);
        router.refresh();
      },
      run: async () => {
        await uploadStagedEditorImages({ images: stagedImages, content: draftContent });
        const result = await updatePageAction({
          page,
          title: draftTitle,
          content: markdownTodoListsToMdx(draftContent),
          revision: contentRevision,
        });
        if (!result.success) {
          throw new Error(result.error || 'Save failed');
        }
        return result.data;
      },
    });
  };

  useDockedActionBar({
    context,
    status: isSubmitting ? 'saving' : 'dirty',
    isSignedIn,
    onSignIn: () => setSettingsOpen(true),
    mode,
    onModeChange: setMode,
    onExit: () => setEditMode(false),
    onSave: handleSubmit,
    saveDisabled: isSaveDisabled,
  });

  return (
    <>
      <PostTitle
        title={draftTitle}
        titleNode={
          <input
            name={`${page}-title`}
            aria-label="Page title"
            value={draftTitle}
            readOnly={readOnlyTitle}
            onChange={event => setDraftTitle(event.target.value)}
            onClick={event => event.stopPropagation()}
            placeholder="Page title"
            className={cn(
              'placeholder:text-muted-foreground w-full min-w-0 bg-transparent font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit] outline-none select-text',
              readOnlyTitle && 'cursor-default',
            )}
          />
        }
      />

      <TiptapEditor
        key={page}
        value={draftContent}
        onChange={setDraftContent}
        mode={mode}
        uploadScope="pages"
        uploadEntityId={page}
        placeholder="Type / for blocks…"
        editorClassName="site-prose-editor-content"
        minHeightClassName="min-h-0"
        onImagesStaged={images =>
          setStagedImages(previous => mergeByKey(previous, images, image => image))
        }
      />

      <EditKeyDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
