'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { updatePageAction } from '@/app/_actions/edit-page';
import { useEditMode } from '@/components/edit-mode-context';
import type { EditViewMode } from '@/components/editing/action-bar';
import { useDockedActionBar } from '@/components/editing/edit-session';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import TiptapEditor from '@/components/editing/tiptap-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import { useContentEditor } from '@/hooks/use-content-editor';
import { isMobileViewport } from '@/hooks/use-is-mobile';
import type { EditablePage } from '@/lib/content-editing-validation';
import { markdownTodoListsToMdx, mdxTodoListsToMarkdown } from '@/lib/mdx-editing';
import { cn } from '@/lib/utils';
import { mergeByPath, type StagedEditorImage } from '@/lib/utils/editor-image';

import PostTitle from './post-title';

interface IPageMdxEditorSurfaceProps {
  page: EditablePage;
  title: string;
  initialContent: string;
}

export default function PageMdxEditorSurface({
  page,
  title,
  initialContent,
}: IPageMdxEditorSurfaceProps) {
  const router = useRouter();
  const { token, setEditMode } = useEditMode();
  // Touch enters edit directly (tap-to-edit); desktop opens in preview.
  const [mode, setMode] = useState<EditViewMode>(() =>
    isMobileViewport() ? 'wysiwyg' : 'preview',
  );
  const { settingsOpen, setSettingsOpen, isSubmitting, submit } = useContentEditor(token);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftContent, setDraftContent] = useState(() => mdxTodoListsToMarkdown(initialContent));
  const [stagedImages, setStagedImages] = useState<StagedEditorImage[]>([]);
  const hasToken = !!token;
  const context = page === 'about' ? 'About' : 'Lines';
  const isSaveDisabled = isSubmitting || !draftTitle.trim();
  const readOnlyTitle = mode === 'preview';

  useEffect(() => {
    setDraftTitle(title);
    setDraftContent(mdxTodoListsToMarkdown(initialContent));
    setStagedImages([]);
  }, [initialContent, title]);

  const handleSubmit = () => {
    submit({
      loading: 'Saving...',
      success: 'Page saved',
      errorFallback: 'Save failed',
      onSuccess: () => {
        setStagedImages([]);
        setMode('preview');
        router.refresh();
      },
      run: async token => {
        await uploadStagedEditorImages({
          images: stagedImages,
          content: draftContent,
          token,
          revalidatePath: page === 'about' ? '/' : `/${page}`,
        });
        const result = await updatePageAction({
          page,
          title: draftTitle,
          content: markdownTodoListsToMdx(draftContent),
          token,
        });
        if (!result.success) {
          throw new Error(result.error || 'Save failed');
        }
        return result;
      },
    });
  };

  useDockedActionBar({
    context,
    status: isSubmitting ? 'saving' : 'dirty',
    hasToken,
    onConnect: () => setSettingsOpen(true),
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
          setStagedImages(previous => mergeByPath(previous, images, image => image))
        }
      />

      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}
