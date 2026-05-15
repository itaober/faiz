'use client';

import { PinIcon, SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { createPostAction, updatePostAction } from '@/app/_actions/edit-content';
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      setIsSettingsOpen(true);
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

  return (
    <>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-3">
          <input
            name="post-title"
            aria-label="Post title"
            value={title}
            onChange={event => handleTitleChange(event.target.value)}
            placeholder="Post title"
            className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-4xl font-bold tracking-tight outline-none"
          />
          <div ref={setToolbarPortal} className="hidden shrink-0 md:flex" />
          <div className="not-prose flex shrink-0 items-center gap-1 pt-1">
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
              onClick={() => setIsSettingsOpen(true)}
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
              aria-label="Save post"
            >
              <SaveIcon className="size-4" />
            </button>
          </div>
        </div>
        <div className="text-muted-foreground mt-2 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            name="post-slug"
            aria-label="Post slug"
            value={slug}
            onChange={event => {
              setSlugTouched(true);
              setSlug(slugify(event.target.value));
            }}
            placeholder="post-slug"
            className="placeholder:text-muted-foreground border-border bg-transparent border-b pb-2 font-mono text-sm outline-none"
          />
          <input
            name="post-tags"
            aria-label="Post tags"
            value={tags}
            onChange={event => setTags(event.target.value)}
            placeholder="tags, separated, by comma"
            className="placeholder:text-muted-foreground border-border bg-transparent border-b pb-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={() => setPinned(value => !value)}
            data-active={pinned || undefined}
            className="focus-ring hover:bg-muted data-[active=true]:text-foreground data-[active=true]:bg-muted text-muted-foreground flex h-9 items-center gap-2 rounded-md px-3 text-sm transition-colors"
          >
            <PinIcon className="size-4" />
            Pinned
          </button>
        </div>
      </div>

      <div className="mb-8">
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
          minHeightClassName="min-h-[48vh]"
          onRequestToken={() => setIsSettingsOpen(true)}
          onImagesStaged={images => {
            setStagedImages(previousImages => {
              const nextImages = new Map(previousImages.map(image => [image.path, image]));
              images.forEach(image => nextImages.set(image.path, image));
              return Array.from(nextImages.values());
            });
          }}
        />
      </div>

      <GitHubTokenDrawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
