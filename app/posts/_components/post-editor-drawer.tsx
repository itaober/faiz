'use client';

import { PinIcon, SaveIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Drawer } from 'vaul';

import { createPostAction, updatePostAction } from '@/app/_actions/edit-content';
import { useEditMode } from '@/components/edit-mode-context';
import { hasEditorFloatingLayer } from '@/components/editing/editor-floating-layer';
import GitHubTokenDrawer from '@/components/editing/github-token-drawer';
import MarkdownLexicalEditor from '@/components/editing/markdown-lexical-editor';
import { uploadStagedEditorImages } from '@/components/editing/upload-staged-editor-images';
import type { PostMeta } from '@/lib/data/data';
import type { StagedEditorImage } from '@/lib/utils/editor-image';

interface IPostEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: PostMeta & { content: string };
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

export default function PostEditorDrawer({ open, onOpenChange, post }: IPostEditorDrawerProps) {
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

  const isEdit = !!post;
  const uploadEntityId = useMemo(() => slug || slugify(title) || 'post', [slug, title]);
  const isSaveDisabled = isSubmitting || !title.trim() || !slug.trim() || !content.trim();

  useEffect(() => {
    if (!open) {
      return;
    }

    setTitle(post?.title ?? '');
    setSlug(post?.slug ?? '');
    setTags(post?.tags.join(', ') ?? '');
    setPinned(Boolean(post?.pinned));
    setContent(post?.content ?? '');
    setStagedImages([]);
    setSlugTouched(Boolean(post));
  }, [open, post]);

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
        onOpenChange(false);
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
      <Drawer.Root direction="right" open={open} onOpenChange={onOpenChange} handleOnly>
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
            <Drawer.Title className="sr-only">{isEdit ? 'Edit Post' : 'New Post'}</Drawer.Title>
            <Drawer.Description className="sr-only">
              Edit post metadata and Markdown content.
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
                  aria-label="Save post"
                >
                  <SaveIcon className="size-6" />
                </button>
              </div>
            </div>

            <div className="border-border grid gap-3 border-b px-4 pb-4">
              <input
                name="post-title"
                aria-label="Post title"
                value={title}
                onChange={event => handleTitleChange(event.target.value)}
                placeholder="Post title"
                className="placeholder:text-muted-foreground bg-transparent text-2xl font-bold outline-none"
              />
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
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

            <div className="flex min-h-0 flex-1 flex-col">
              <MarkdownLexicalEditor
                key={`${post?.slug ?? 'new'}-${open}`}
                value={content}
                onChange={setContent}
                token={token}
                uploadScope="posts"
                uploadEntityId={uploadEntityId}
                revalidatePath={isEdit && post ? `/posts/${post.slug}` : '/posts'}
                placeholder="Start writing..."
                minHeightClassName="min-h-[58vh]"
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
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <GitHubTokenDrawer open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
    </>
  );
}
