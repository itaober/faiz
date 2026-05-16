'use client';

import { PinIcon, SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { createPostAction, updatePostAction } from '@/app/_actions/edit-content';
import PostTitle from '@/app/_components/post-title';
import { useEditMode } from '@/components/edit-mode-context';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import MarkdownLexicalEditor from '@/components/editing/markdown-lexical-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import type { PostMeta } from '@/lib/data/data';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IPostEditorSurfaceProps {
  post?: PostMeta & { content: string };
  onCancel: () => void;
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

export default function PostEditorSurface({ post, onCancel }: IPostEditorSurfaceProps) {
  const router = useRouter();
  const { token } = useEditMode();
  const [isTokenSettingsOpen, setIsTokenSettingsOpen] = useState(false);
  const [isPostSettingsOpen, setIsPostSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [tags, setTags] = useState(post?.tags.join(', ') ?? '');
  const [pinned, setPinned] = useState(Boolean(post?.pinned));
  const [content, setContent] = useState(post?.content ?? '');
  const [stagedImages, setStagedImages] = useState<StagedEditorImage[]>([]);
  const [slugTouched, setSlugTouched] = useState(Boolean(post));
  const [toolbarPortal, setToolbarPortal] = useState<HTMLElement | null>(null);

  const isEdit = !!post;
  const uploadEntityId = useMemo(() => slug || slugify(title) || 'post', [slug, title]);
  const isSaveDisabled = isSubmitting || !title.trim() || !slug.trim() || !content.trim();

  useEffect(() => {
    setTitle(post?.title ?? '');
    setSlug(post?.slug ?? '');
    setTags(post?.tags.join(', ') ?? '');
    setPinned(Boolean(post?.pinned));
    setContent(post?.content ?? '');
    setStagedImages([]);
    setSlugTouched(Boolean(post));
  }, [post]);

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  };

  const handleSubmit = async () => {
    if (!token) {
      setIsTokenSettingsOpen(true);
      return;
    }

    setIsSubmitting(true);
    const submitPost = async () => {
      await uploadStagedEditorImages({
        images: stagedImages,
        content,
        token,
        revalidatePath: isEdit && post ? `/posts/${post.slug}` : '/posts',
      });

      const payload = {
        title,
        slug,
        tags: parseTags(tags),
        pinned,
        content,
        token,
      };

      const result =
        isEdit && post
          ? await updatePostAction({
              ...payload,
              originalSlug: post.slug,
              createdTime: post.createdTime,
            })
          : await createPostAction(payload);

      if (!result.success) {
        throw new Error(result.error || 'Save failed');
      }

      return result.data;
    };

    toast.promise(submitPost(), {
      loading: isEdit ? 'Updating...' : 'Publishing...',
      success: savedPost => {
        setStagedImages([]);
        onCancel();
        router.refresh();
        if (savedPost?.slug) {
          router.push(`/posts/${savedPost.slug}`);
        }
        return isEdit ? 'Post updated' : 'Post published';
      },
      error: error => error.message || 'Save failed',
      finally: () => setIsSubmitting(false),
    });
  };

  const renderActions = () => (
    <>
      <button
        type="button"
        onClick={onCancel}
        className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-8"
        aria-label="Cancel editing"
      >
        <XIcon className="size-4" />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsPostSettingsOpen(open => !open)}
          data-active={isPostSettingsOpen || undefined}
          className="focus-ring icon-button hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground text-muted-foreground hover:text-foreground size-8"
          aria-label="Post settings"
        >
          <SettingsIcon className="size-4" />
        </button>
        {isPostSettingsOpen && (
          <div className="bg-background border-border absolute top-full right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-muted-foreground text-xs font-medium">Post settings</p>
              <button
                type="button"
                onClick={() => setIsPostSettingsOpen(false)}
                className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground size-7"
                aria-label="Close post settings"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
            <label className="mb-3 block">
              <span className="text-muted-foreground mb-1 block text-xs">Slug</span>
              <input
                name="post-slug"
                aria-label="Post slug"
                value={slug}
                onChange={event => {
                  setSlugTouched(true);
                  setSlug(slugify(event.target.value));
                }}
                placeholder="post-slug"
                className="border-border placeholder:text-muted-foreground focus:border-foreground/40 w-full rounded-md border bg-transparent px-2.5 py-2 font-mono text-xs outline-none"
              />
            </label>
            <label className="mb-3 block">
              <span className="text-muted-foreground mb-1 block text-xs">Tags</span>
              <input
                name="post-tags"
                aria-label="Post tags"
                value={tags}
                onChange={event => setTags(event.target.value)}
                placeholder="tags, separated, by comma"
                className="border-border placeholder:text-muted-foreground focus:border-foreground/40 w-full rounded-md border bg-transparent px-2.5 py-2 text-xs outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => setPinned(value => !value)}
              data-active={pinned || undefined}
              className="focus-ring hover:bg-muted data-[active=true]:text-foreground data-[active=true]:bg-muted text-muted-foreground mb-2 flex h-8 items-center gap-2 rounded-md px-2 text-xs transition-colors"
            >
              <PinIcon className="size-3.5" />
              Pinned
            </button>
            <button
              type="button"
              onClick={() => setIsTokenSettingsOpen(true)}
              className="focus-ring hover:bg-muted text-muted-foreground hover:text-foreground flex h-8 items-center rounded-md px-2 text-xs transition-colors"
            >
              GitHub token settings
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isSaveDisabled}
        className="focus-ring icon-button hover:bg-muted text-muted-foreground hover:text-foreground disabled:text-muted-foreground/50 size-8 disabled:cursor-not-allowed"
        aria-label="Save post"
      >
        <SaveIcon className="size-4" />
      </button>
    </>
  );

  const parsedTags = parseTags(tags);

  return (
    <>
      <PostTitle
        title={title || 'Post title'}
        titleNode={
          <input
            name="post-title"
            aria-label="Post title"
            value={title}
            onChange={event => handleTitleChange(event.target.value)}
            onClick={event => event.stopPropagation()}
            placeholder="Post title"
            className="placeholder:text-muted-foreground w-full min-w-0 bg-transparent font-[inherit] leading-[inherit] tracking-[inherit] text-[inherit] outline-none select-text"
          />
        }
        createdTime={post?.createdTime}
        updatedTime={post?.updatedTime}
        tags={parsedTags}
      >
        <div ref={setToolbarPortal} className="hidden shrink-0 md:flex" />
        {renderActions()}
      </PostTitle>

      <MarkdownLexicalEditor
        key={post?.slug ?? 'new-post'}
        value={content}
        onChange={setContent}
        token={token}
        uploadScope="posts"
        uploadEntityId={uploadEntityId}
        revalidatePath={isEdit && post ? `/posts/${post.slug}` : '/posts'}
        placeholder="Start writing..."
        chrome="seamless"
        showQuickReference={false}
        toolbarPortal={toolbarPortal}
        floatingActions={renderActions()}
        editorClassName="site-prose-editor-content"
        minHeightClassName={content.trim() ? 'min-h-0' : 'min-h-40'}
        onRequestToken={() => setIsTokenSettingsOpen(true)}
        onImagesStaged={images => {
          setStagedImages(previousImages => {
            const nextImages = new Map(previousImages.map(image => [image.path, image]));
            images.forEach(image => nextImages.set(image.path, image));
            return Array.from(nextImages.values());
          });
        }}
      />

      <GitHubTokenDrawer open={isTokenSettingsOpen} onOpenChange={setIsTokenSettingsOpen} />
    </>
  );
}
