'use client';

import dayjs from 'dayjs';
import { CalendarIcon, PinIcon, Trash2Icon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createPostAction, deletePostAction, updatePostAction } from '@/app/_actions/edit-post';
import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import type { ActionBarTool, EditViewMode } from '@/components/editing/action-bar';
import ConfirmDrawer from '@/components/editing/confirm-drawer';
import { useDockedActionBar } from '@/components/editing/edit-session';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import TiptapEditor from '@/components/editing/tiptap-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import { useContentEditor } from '@/hooks/use-content-editor';
import { isMobileViewport } from '@/hooks/use-is-mobile';
import type { PostMeta } from '@/lib/data/data';
import { markdownTodoListsToMdx, mdxTodoListsToMarkdown } from '@/lib/mdx-editing';
import { cn } from '@/lib/utils';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IPostEditorSurfaceProps {
  post?: PostMeta & { content: string };
  onExit: () => void;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const parseTags = (value: string) =>
  value
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

const formatPostDateInput = (value?: string) => {
  if (!value) {
    return dayjs().format('YYYY-MM-DD');
  }
  return value.slice(0, 10);
};

const buildPostCreatedTime = (dateValue: string, previousValue?: string) => {
  const date = dateValue || formatPostDateInput(previousValue);
  const previousTime = previousValue?.match(/\b(\d{2}:\d{2}:\d{2})\b/)?.[1];
  const time = previousTime ?? dayjs().format('HH:mm:ss');
  return `${date} ${time}`;
};

export default function PostEditorSurface({ post, onExit }: IPostEditorSurfaceProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const isEdit = !!post;
  const [mode, setMode] = useState<EditViewMode>(() =>
    !isEdit || isMobileViewport() ? 'wysiwyg' : 'preview',
  );
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
  const [title, setTitle] = useState(post?.title ?? '');
  const [tags, setTags] = useState(post?.tags.join(', ') ?? '');
  const [pinned, setPinned] = useState(Boolean(post?.pinned));
  const [createdTime, setCreatedTime] = useState(formatPostDateInput(post?.createdTime));
  // Checkboxes (<TodoList>/<CheckboxRoot>) edit as markdown task lists, like pages.
  const [content, setContent] = useState(() => mdxTodoListsToMarkdown(post?.content ?? ''));
  const [stagedImages, setStagedImages] = useState<StagedEditorImage[]>([]);
  const postDateInputRef = useRef<HTMLInputElement>(null);

  const hasToken = !!token;
  const slug = useMemo(() => post?.slug ?? (slugify(title) || 'post'), [post, title]);
  const uploadEntityId = slug;
  const isSaveDisabled = isSubmitting || !title.trim() || !content.trim();
  const isPreview = mode === 'preview';
  // Pin is editable in preview mode, so the bar must allow saving when it differs
  // from the saved value — otherwise toggling pin has no persistable effect.
  const pinDirty = pinned !== Boolean(post?.pinned);

  useEffect(() => {
    setTitle(post?.title ?? '');
    setTags(post?.tags.join(', ') ?? '');
    setPinned(Boolean(post?.pinned));
    setCreatedTime(formatPostDateInput(post?.createdTime));
    setContent(mdxTodoListsToMarkdown(post?.content ?? ''));
    setStagedImages([]);
  }, [post]);

  const openPostDatePicker = () => {
    const input = postDateInputRef.current;
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    try {
      input.showPicker();
    } catch {
      input.click();
    }
  };

  const handleSubmit = () => {
    // Convert task lists back to MDX (<TodoList>) before saving; the server still
    // normalises images (![](…) → <Image>).
    const mdxContent = markdownTodoListsToMdx(content);
    submit<PostMeta | undefined>({
      loading: isEdit ? 'Updating...' : 'Publishing...',
      success: isEdit ? 'Post updated' : 'Post published',
      errorFallback: 'Save failed',
      onSuccess: savedPost => {
        setStagedImages([]);
        setMode('preview');
        router.refresh();
        if (!isEdit && savedPost?.slug) {
          router.push(`/posts/${savedPost.slug}`);
        }
      },
      run: async token => {
        await uploadStagedEditorImages({
          images: stagedImages,
          content: mdxContent,
          token,
          revalidatePath: isEdit && post ? `/posts/${post.slug}` : '/posts',
        });

        const payload = {
          title,
          slug,
          tags: parseTags(tags),
          pinned,
          createdTime: buildPostCreatedTime(createdTime, post?.createdTime),
          content: mdxContent,
          token,
        };

        const result =
          isEdit && post
            ? await updatePostAction({ ...payload, originalSlug: post.slug })
            : await createPostAction(payload);

        if (!result.success) {
          throw new Error(result.error || 'Save failed');
        }
        return result.data;
      },
    });
  };

  const handleDelete = () => {
    if (!post) {
      return;
    }
    remove({
      loading: 'Deleting...',
      success: 'Post deleted',
      errorFallback: 'Delete failed',
      onSuccess: () => {
        setConfirmOpen(false);
        router.push('/posts');
        router.refresh();
      },
      run: async token => {
        const result = await deletePostAction({ slug: post.slug, token });
        if (!result.success) {
          throw new Error(result.error || 'Delete failed');
        }
      },
    });
  };

  const parsedTags = parseTags(tags);
  const tagsWidth = `${Math.min(Math.max(tags.length || 4, 4), 32)}ch`;

  const editableMeta = (
    <>
      <div className="flex min-h-6 items-center gap-1">
        <CalendarIcon className="size-3.5 shrink-0" />
        <span className="relative -mx-1 inline-flex items-center">
          <button
            type="button"
            onClick={openPostDatePicker}
            className="focus-ring hover:text-foreground rounded-sm px-1 transition-colors"
            aria-label="Edit post date"
          >
            {dayjs(createdTime).format('MMM DD, YYYY')}
          </button>
          <input
            ref={postDateInputRef}
            name="post-created-time"
            aria-label="Post date"
            type="date"
            value={createdTime}
            onChange={event => setCreatedTime(event.target.value)}
            tabIndex={-1}
            className="pointer-events-none absolute inset-0 h-full w-full opacity-0 [color-scheme:light] dark:[color-scheme:dark]"
          />
        </span>
      </div>
      <span>·</span>
      <input
        name="post-tags-inline"
        aria-label="Post tags"
        value={tags}
        onChange={event => setTags(event.target.value)}
        placeholder="tags"
        style={{ width: tagsWidth }}
        className={cn(
          'focus-ring border-border placeholder:text-muted-foreground/70 h-6 max-w-[18rem] min-w-14 rounded-md border bg-transparent px-2 py-0.5 text-xs font-medium outline-none transition-colors',
          tags.trim()
            ? 'text-muted-foreground hover:bg-muted/65 hover:text-foreground focus:text-foreground'
            : 'text-muted-foreground/70 focus:text-foreground',
        )}
      />
    </>
  );

  const tools: ActionBarTool[] = [
    {
      icon: PinIcon,
      label: pinned ? 'Unpin' : 'Pin to top',
      active: pinned,
      activeFill: true,
      onClick: () => setPinned(value => !value),
    },
  ];
  if (isEdit) {
    tools.push({
      icon: Trash2Icon,
      label: 'Delete post',
      danger: true,
      onClick: () => setConfirmOpen(true),
    });
  }

  useDockedActionBar({
    context: title.trim() || (isEdit ? 'Post' : 'New post'),
    status: isSubmitting ? 'saving' : pinDirty || !isPreview ? 'dirty' : 'idle',
    hasToken,
    onConnect: () => setSettingsOpen(true),
    mode,
    onModeChange: setMode,
    tools,
    onExit,
    onSave: handleSubmit,
    saveLabel: isEdit ? 'Save' : 'Publish',
    saveDisabled: isSaveDisabled,
    dirty: pinDirty,
  });

  return (
    <>
      <PostTitle
        title={title || 'Post title'}
        titleNode={
          <input
            name="post-title"
            aria-label="Post title"
            value={title}
            readOnly={isPreview}
            onChange={event => setTitle(event.target.value)}
            onClick={event => event.stopPropagation()}
            placeholder="Post title"
            className={cn(
              'placeholder:text-muted-foreground w-full min-w-0 bg-transparent font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit] outline-none select-text',
              isPreview && 'cursor-default',
            )}
          />
        }
        createdTime={isPreview ? (post?.createdTime ?? createdTime) : undefined}
        updatedTime={isPreview ? post?.updatedTime : undefined}
        tags={isPreview ? parsedTags : undefined}
        metaNode={isPreview ? undefined : editableMeta}
      />

      <TiptapEditor
        key={post?.slug ?? 'new-post'}
        value={content}
        onChange={setContent}
        mode={mode}
        uploadScope="posts"
        uploadEntityId={uploadEntityId}
        placeholder="Start writing… type / for blocks"
        editorClassName="site-prose-editor-content"
        minHeightClassName={content.trim() ? 'min-h-0' : 'min-h-40'}
        autoFocus={!isEdit}
        onImagesStaged={images => {
          setStagedImages(previousImages => {
            const nextImages = new Map(previousImages.map(image => [image.path, image]));
            images.forEach(image => nextImages.set(image.path, image));
            return Array.from(nextImages.values());
          });
        }}
      />

      <GitHubTokenDrawer open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ConfirmDrawer
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete post?"
        description="This removes the MDX file and updates the posts index."
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
