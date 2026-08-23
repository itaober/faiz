'use client';

import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import {
  BoldIcon,
  CheckIcon,
  ChevronDownIcon,
  CodeIcon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListTodoIcon,
  QuoteIcon,
  StrikethroughIcon,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useIsMobile } from '@/hooks/use-is-mobile';
import { cn } from '@/lib/utils';
import {
  buildEditorImageStoragePath,
  type EditorImageScope,
  formatMdxImage,
  generateEditorImageId,
  getImageCaptionFromFilename,
  mdxImagesToMarkdown,
  type StagedEditorImage,
  toApiImageUrl,
} from '@/lib/utils/editor-image';
import {
  compressImage,
  fileToBase64,
  isSupportedImageType,
  MAX_IMAGE_SIZE,
  SUPPORTED_IMAGE_TYPES,
} from '@/lib/utils/image';

import type { EditViewMode } from './action-bar';
import { useSetMobileEditing } from './edit-session';
import {
  groupAdjacentImages,
  ImageGallery,
  registerGalleryStaging,
  registerImagePreview,
  SlashCommand,
  StagedImage,
} from './tiptap/extensions';

interface ITiptapEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  uploadScope: EditorImageScope;
  uploadEntityId: string;
  className?: string;
  editorClassName?: string;
  minHeightClassName?: string;
  /** View mode, controlled by the ActionBar. preview = read-only, wysiwyg = editable. */
  mode?: EditViewMode;
  /** Whether staged images are inserted into the document (false for memos). */
  insertUploadedImages?: boolean;
  /** Increment to trigger the file picker from an external "attach image" control. */
  imageUploadRequestId?: number;
  /** Called with images staged in-memory; the parent uploads them on save. */
  onImagesStaged?: (images: StagedEditorImage[]) => void;
  editorFooter?: ReactNode;
  autoFocus?: boolean;
}

// ── Selection bubble (marks + link) ──────────────────────────────────────────
function SelectionBubble({
  editor,
  enabled,
}: {
  editor: ReturnType<typeof useEditor>;
  enabled: boolean;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');

  if (!editor) {
    return null;
  }

  const mark = (active: boolean) => (active ? 'true' : undefined);
  const openLink = () => {
    setLinkValue(editor.getAttributes('link').href ?? '');
    setLinkOpen(true);
  };
  const applyLink = () => {
    const href = linkValue.trim();
    if (href) {
      editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkOpen(false);
  };

  return (
    <BubbleMenu
      editor={editor}
      pluginKey="fzSelectionBubble"
      shouldShow={({ editor: e, from, to }) =>
        enabled && e.isEditable && from !== to && !e.isActive('codeBlock') && !e.isActive('image')
      }
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: container only swallows mousedown so the editor keeps its selection; the controls inside are buttons */}
      <div className="fz-bubble" onMouseDown={event => event.preventDefault()}>
        {linkOpen ? (
          <>
            <input
              // biome-ignore lint/a11y/noAutofocus: link popover opens on user intent; focusing its only input is the expected behaviour
              autoFocus
              value={linkValue}
              onChange={event => setLinkValue(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
                if (event.key === 'Escape') {
                  setLinkOpen(false);
                }
              }}
              placeholder="Paste link…"
            />
            <button type="button" onClick={applyLink} aria-label="Apply link">
              <CheckIcon className="size-[15px]" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              data-active={mark(editor.isActive('bold'))}
              onClick={() => editor.chain().focus().toggleBold().run()}
              aria-label="Bold"
            >
              <BoldIcon className="size-[15px]" />
            </button>
            <button
              type="button"
              data-active={mark(editor.isActive('italic'))}
              onClick={() => editor.chain().focus().toggleItalic().run()}
              aria-label="Italic"
            >
              <ItalicIcon className="size-[15px]" />
            </button>
            <button
              type="button"
              data-active={mark(editor.isActive('strike'))}
              onClick={() => editor.chain().focus().toggleStrike().run()}
              aria-label="Strikethrough"
            >
              <StrikethroughIcon className="size-[15px]" />
            </button>
            <button
              type="button"
              data-active={mark(editor.isActive('code'))}
              onClick={() => editor.chain().focus().toggleCode().run()}
              aria-label="Inline code"
            >
              <CodeIcon className="size-[15px]" />
            </button>
            <span className="fz-tb-div" />
            <button
              type="button"
              data-active={mark(editor.isActive('link'))}
              onClick={openLink}
              aria-label="Link"
            >
              <LinkIcon className="size-[15px]" />
            </button>
          </>
        )}
      </div>
    </BubbleMenu>
  );
}

// ── Mobile formatting pill ───────────────────────────────────────────────────
// Mirrors the docked ActionBar's pill (same shape + bottom-center anchor, raised
// above the keyboard) so it cross-fades in place with the action pill — one bar
// that morphs between "document actions" and "formatting" as you focus the text.
const FORMAT_PILL_MOTION = {
  initial: { opacity: 0, x: '-50%', y: 8, scale: 0.96 },
  animate: { opacity: 1, x: '-50%', y: 0, scale: 1 },
  exit: { opacity: 0, x: '-50%', y: 8, scale: 0.96 },
} as const;

function MobileFormatToolbar({
  editor,
  onImage,
  bottom,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  onImage: () => void;
  bottom: number;
}) {
  const tools: {
    key: string;
    label: string;
    icon: typeof BoldIcon;
    run: () => void;
    on?: boolean;
  }[] = [
    {
      key: 'bold',
      label: 'Bold',
      icon: BoldIcon,
      run: () => editor.chain().focus().toggleBold().run(),
      on: editor.isActive('bold'),
    },
    {
      key: 'italic',
      label: 'Italic',
      icon: ItalicIcon,
      run: () => editor.chain().focus().toggleItalic().run(),
      on: editor.isActive('italic'),
    },
    {
      key: 'h2',
      label: 'Heading',
      icon: Heading2Icon,
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      on: editor.isActive('heading', { level: 2 }),
    },
    {
      key: 'list',
      label: 'List',
      icon: ListIcon,
      run: () => editor.chain().focus().toggleBulletList().run(),
      on: editor.isActive('bulletList'),
    },
    {
      key: 'todo',
      label: 'Todo',
      icon: ListTodoIcon,
      run: () => editor.chain().focus().toggleTaskList().run(),
      on: editor.isActive('taskList'),
    },
    {
      key: 'quote',
      label: 'Quote',
      icon: QuoteIcon,
      run: () => editor.chain().focus().toggleBlockquote().run(),
      on: editor.isActive('blockquote'),
    },
    { key: 'image', label: 'Image', icon: ImageIcon, run: onImage },
  ];

  return (
    <motion.div
      {...FORMAT_PILL_MOTION}
      transition={{ type: 'spring', stiffness: 520, damping: 40, mass: 0.6 }}
      className="fz-actionbar fz-format-pill"
      style={{ bottom: `calc(${bottom}px + max(1.25rem, env(safe-area-inset-bottom)))` }}
      onMouseDown={event => event.preventDefault()}
    >
      {tools.map(tool => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.key}
            type="button"
            className="fz-iconbtn"
            data-active={tool.on ? 'true' : undefined}
            aria-label={tool.label}
            onClick={tool.run}
          >
            <Icon className="size-[18px]" />
          </button>
        );
      })}
      <span className="fz-actionbar-sep" />
      <button
        type="button"
        className="fz-iconbtn"
        aria-label="Dismiss keyboard"
        onClick={() => editor.commands.blur()}
      >
        <ChevronDownIcon className="size-[18px]" />
      </button>
    </motion.div>
  );
}

export default function TiptapEditor({
  value,
  onChange,
  placeholder = 'Write something…',
  uploadScope,
  uploadEntityId,
  className,
  editorClassName,
  minHeightClassName = 'min-h-72',
  insertUploadedImages = true,
  imageUploadRequestId = 0,
  onImagesStaged,
  editorFooter,
  mode = 'wysiwyg',
  autoFocus = false,
}: ITiptapEditorProps) {
  const isMobile = useIsMobile();
  const setMobileEditing = useSetMobileEditing();
  const [isFocused, setIsFocused] = useState(false);
  const [keyboardBottom, setKeyboardBottom] = useState(0);
  const fileInputId = useId();
  const galleryInputId = useId();
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const markdownRef = useRef<HTMLTextAreaElement>(null);
  const previousModeRef = useRef<EditViewMode>(mode);
  // Latest props read inside the editor's stable callbacks (onUpdate, paste…).
  // Kept as raw refs (not a useLatest hook) so the React Compiler still
  // recognises them as stable and can optimise the callbacks below.
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const insertRef = useRef(insertUploadedImages);
  const onImagesStagedRef = useRef(onImagesStaged);

  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
    insertRef.current = insertUploadedImages;
    onImagesStagedRef.current = onImagesStaged;
  });

  const openFilePicker = useCallback(() => {
    (document.getElementById(fileInputId) as HTMLInputElement | null)?.click();
  }, [fileInputId]);

  const openGalleryPicker = useCallback(() => {
    (document.getElementById(galleryInputId) as HTMLInputElement | null)?.click();
  }, [galleryInputId]);

  // Stage files in-memory (compress + register preview) and hand the refs to the
  // parent for upload-on-save. Does NOT touch the document — callers decide how
  // to place the result (single image, new gallery, or append to one).
  const processFiles = useCallback(
    async (files: File[]): Promise<StagedEditorImage[]> => {
      const valid = files.filter(file => {
        if (!isSupportedImageType(file.type)) {
          toast.error(`Unsupported format: ${file.name}`);
          return false;
        }
        if (file.size > MAX_IMAGE_SIZE) {
          toast.error(`File too large: ${file.name}`);
          return false;
        }
        return true;
      });
      if (!valid.length) {
        return [];
      }

      const process = async () => {
        const staged: StagedEditorImage[] = [];
        for (const file of valid) {
          const compressed = await compressImage(file);
          const imageBase64 = await fileToBase64(compressed);
          const imageId = generateEditorImageId();
          const alt = getImageCaptionFromFilename(file.name);
          const path = buildEditorImageStoragePath({
            entityId: uploadEntityId,
            imageId,
            scope: uploadScope,
          });
          const src = toApiImageUrl(path);
          const previewSrc = `data:image/webp;base64,${imageBase64}`;
          registerImagePreview(src, previewSrc);

          staged.push({
            alt,
            fileName: file.name,
            imageBase64,
            imageId,
            markup: formatMdxImage(src, alt),
            mimeType: 'image/webp',
            path,
            previewSrc,
            scope: uploadScope,
            src,
            uploadEntityId,
          });
        }
        onImagesStagedRef.current?.(staged);
        return staged;
      };

      const promise = process();
      toast.promise(promise, {
        loading: valid.length > 1 ? `Processing ${valid.length} images…` : 'Processing image…',
        success: 'Image ready · uploads on save',
        error: error => (error instanceof Error ? error.message : 'Failed to process image'),
      });
      return promise;
    },
    [uploadEntityId, uploadScope],
  );

  // Place freshly-picked files into the document: a single file becomes a plain
  // image (basic usage unchanged); two or more become one gallery node.
  const insertFiles = useCallback(
    async (files: File[]) => {
      const staged = await processFiles(files);
      const editor = editorRef.current;
      if (!staged.length || !insertRef.current || !editor) {
        return;
      }
      if (staged.length === 1) {
        editor.chain().focus().setImage({ src: staged[0].src, alt: staged[0].alt }).run();
      } else {
        editor
          .chain()
          .focus()
          .setImageGallery(staged.map(image => ({ src: image.src, alt: image.alt })))
          .run();
      }
    },
    [processFiles],
  );

  // Explicit "Image gallery" command: always builds a gallery node (even a single
  // pick) so the user can keep adding to it — distinct from the count-based insert.
  const insertGallery = useCallback(
    async (files: File[]) => {
      const staged = await processFiles(files);
      const editor = editorRef.current;
      if (!staged.length || !insertRef.current || !editor) {
        return;
      }
      editor
        .chain()
        .focus()
        .setImageGallery(staged.map(image => ({ src: image.src, alt: image.alt })))
        .run();
    },
    [processFiles],
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder }),
      StagedImage,
      ImageGallery,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Markdown,
      SlashCommand.configure({
        onImage: () => openFilePicker(),
        // Galleries only apply where inline images are inserted (posts/pages),
        // not memos — omit the command there.
        onImageGallery: insertUploadedImages ? () => openGalleryPicker() : undefined,
      }),
    ],
    [placeholder, openFilePicker, openGalleryPicker, insertUploadedImages],
  );

  const editor = useEditor({
    extensions,
    content: mdxImagesToMarkdown(value),
    contentType: 'markdown',
    editable: mode === 'wysiwyg',
    immediatelyRender: false,
    autofocus: autoFocus && mode === 'wysiwyg' ? 'end' : false,
    editorProps: {
      attributes: { class: 'tiptap focus:outline-none' },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter(file =>
          isSupportedImageType(file.type),
        );
        if (files.length) {
          event.preventDefault();
          insertFiles(files).catch(() => undefined);
          return true;
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []).filter(file =>
          isSupportedImageType(file.type),
        );
        if (files.length) {
          event.preventDefault();
          insertFiles(files).catch(() => undefined);
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor: instance }) => {
      // Merge the consecutive images loaded from stored markdown into gallery
      // nodes before the editor first renders, so individual images never paint
      // and then collapse (no flash, no redundant node-view churn).
      if (insertUploadedImages) {
        groupAdjacentImages(instance);
      }
    },
    onUpdate: ({ editor: instance }) => onChangeRef.current(instance.getMarkdown()),
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Keep the gallery node's "add images" wired to the latest staging closure.
  useEffect(() => {
    if (editor) {
      registerGalleryStaging(editor, async files =>
        (await processFiles(files)).map(image => ({ src: image.src, alt: image.alt })),
      );
    }
  }, [editor, processFiles]);

  // External "attach image" trigger.
  useEffect(() => {
    if (imageUploadRequestId > 0) {
      openFilePicker();
    }
  }, [imageUploadRequestId, openFilePicker]);

  // Track the keyboard inset so the formatting toolbar can dock above it.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return;
    }
    const update = () => {
      const inset = window.innerHeight - (viewport.height + viewport.offsetTop);
      setKeyboardBottom(Math.max(0, Math.round(inset)));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);

  // While the formatting pill is up on mobile, tell the dock to yield its slot so
  // the two pills cross-fade in place instead of overlapping.
  const showMobileToolbar = isMobile && isFocused && mode === 'wysiwyg';
  useEffect(() => {
    setMobileEditing(showMobileToolbar);
    return () => setMobileEditing(false);
  }, [showMobileToolbar, setMobileEditing]);

  // Auto-grow the markdown textarea to fit its content.
  // biome-ignore lint/correctness/useExhaustiveDependencies: value is the trigger — new content means a new scrollHeight to measure
  useEffect(() => {
    const textarea = markdownRef.current;
    if (mode === 'markdown' && textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [mode, value]);

  // The ActionBar controls the view mode. Keep the editor's editable/content in
  // sync, and reload markdown into the editor when leaving the textarea mode.
  useEffect(() => {
    if (!editor) {
      return;
    }
    if (mode !== 'markdown') {
      if (previousModeRef.current === 'markdown') {
        editor.commands.setContent(mdxImagesToMarkdown(valueRef.current), {
          contentType: 'markdown',
        });
        if (insertUploadedImages) {
          groupAdjacentImages(editor);
        }
      }
      editor.setEditable(mode === 'wysiwyg');
      // Entering edit puts the caret in the doc so the user can type immediately.
      // Use 'end' only for fresh drafts (autoFocus); otherwise keep the position
      // (no scroll jump on long documents).
      if (mode === 'wysiwyg' && previousModeRef.current !== 'wysiwyg') {
        editor.commands.focus(autoFocus ? 'end' : undefined);
      }
    }
    previousModeRef.current = mode;
  }, [editor, mode, autoFocus, insertUploadedImages]);

  if (!editor) {
    return <div className={cn('text-muted-foreground/60 text-sm', minHeightClassName)} />;
  }

  return (
    <div className={cn('relative', className)}>
      {mode === 'markdown' ? (
        <textarea
          ref={markdownRef}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className={cn(
            'placeholder:text-muted-foreground/70 w-full resize-none overflow-hidden bg-transparent font-mono text-sm leading-relaxed outline-none',
            minHeightClassName,
          )}
        />
      ) : (
        <>
          {/* biome-ignore lint/a11y/noStaticElementInteractions: click-below-content is a pointer affordance for reaching the caret; the contenteditable inside owns keyboard input */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: same — keyboard users are already inside the editable region */}
          <div
            className={cn(
              'prose dark:prose-invert max-w-none',
              editorClassName,
              minHeightClassName,
            )}
            onClick={event => {
              // Only the empty area below the content jumps the caret to the end.
              // Clicks on content (or a caption input in a node view) must not, or
              // they'd steal focus and scroll the page to the bottom.
              if (event.target !== event.currentTarget) {
                return;
              }
              if (mode === 'wysiwyg' && !editor.isFocused) {
                editor.commands.focus('end');
              }
            }}
          >
            <EditorContent editor={editor} />
          </div>
          <SelectionBubble editor={editor} enabled={!isMobile} />
          <AnimatePresence>
            {showMobileToolbar ? (
              <MobileFormatToolbar
                key="format-pill"
                editor={editor}
                onImage={openFilePicker}
                bottom={keyboardBottom}
              />
            ) : null}
          </AnimatePresence>
        </>
      )}

      {editorFooter}

      <input
        id={fileInputId}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        aria-label="Upload image"
        onChange={event => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) {
            insertFiles(files).catch(() => undefined);
          }
        }}
      />

      <input
        id={galleryInputId}
        type="file"
        accept={SUPPORTED_IMAGE_TYPES.join(',')}
        multiple
        className="hidden"
        aria-label="Upload gallery images"
        onChange={event => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) {
            insertGallery(files).catch(() => undefined);
          }
        }}
      />
    </div>
  );
}

export type { ITiptapEditorProps };
