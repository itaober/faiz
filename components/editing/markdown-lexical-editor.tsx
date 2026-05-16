'use client';

import { $createCodeNode, CodeNode } from '@lexical/code';
import { $createLinkNode, $toggleLink, LinkNode } from '@lexical/link';
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
} from '@lexical/list';
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  type ElementTransformer,
  type MultilineElementTransformer,
  type TextMatchTransformer,
  type Transformer,
  TRANSFORMERS,
} from '@lexical/markdown';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import { HorizontalRulePlugin } from '@lexical/react/LexicalHorizontalRulePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  $createTableCellNode,
  $createTableNode,
  $createTableRowNode,
  $isTableCellNode,
  $isTableNode,
  $isTableRowNode,
  TableCellHeaderStates,
  TableCellNode,
  TableNode,
  TableRowNode,
} from '@lexical/table';
import {
  $applyNodeReplacement,
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  $getPreviousSelection,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  DecoratorNode,
  type EditorConfig,
  type EditorState,
  KEY_DOWN_COMMAND,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
  type TextFormatType,
} from 'lexical';
import {
  BoldIcon,
  CheckIcon,
  CheckSquareIcon,
  CodeIcon,
  EyeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImagePlusIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  PanelTopIcon,
  PilcrowIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  TextIcon,
  XIcon,
} from 'lucide-react';
import {
  type CSSProperties,
  type MutableRefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import {
  buildEditorImageStoragePath,
  formatMdxImage,
  generateEditorImageId,
  getImageCaptionFromFilename,
  normalizeEditorImageMarkup,
  type StagedEditorImage,
  toApiImageUrl,
  unescapeMarkdownValue,
} from '@/lib/utils/editor-image';
import { compressImage, MAX_IMAGE_SIZE, SUPPORTED_IMAGE_TYPES } from '@/lib/utils/image';

type EditorMode = 'wysiwyg' | 'markdown';
type UploadScope = 'memos' | 'posts' | 'pages' | 'records';
type ToolbarCommand =
  | 'paragraph'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bold'
  | 'italic'
  | 'strike'
  | 'code'
  | 'ul'
  | 'ol'
  | 'todo'
  | 'quote'
  | 'codeblock'
  | 'hr'
  | 'link'
  | 'image'
  | 'table';

interface IMarkdownLexicalEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  token?: string | null;
  uploadScope: UploadScope;
  uploadEntityId: string;
  revalidatePath?: string;
  className?: string;
  editorClassName?: string;
  minHeightClassName?: string;
  chrome?: 'panel' | 'seamless';
  showQuickReference?: boolean;
  showMobileToolbarOverlay?: boolean;
  toolbarPlacement?: 'auto' | 'below';
  toolbarPortal?: HTMLElement | null;
  floatingActions?: ReactNode;
  onRequestToken?: () => void;
  insertUploadedImages?: boolean;
  onImagesStaged?: (images: StagedEditorImage[]) => void;
  editorFooter?: ReactNode;
}

const theme = {
  paragraph: '',
  heading: {
    h1: '',
    h2: '',
    h3: '',
  },
  quote: '',
  list: {
    ul: '',
    ol: '',
    listitem: '',
    checklist: 'editor-checklist-list',
    listitemChecked: 'editor-checklist-item',
    listitemUnchecked: 'editor-checklist-item',
  },
  text: {
    bold: 'font-semibold',
    italic: 'italic',
    strikethrough: 'line-through',
    code: 'bg-muted text-foreground rounded px-1 py-0.5 font-mono text-[0.875em] font-medium leading-[inherit]',
  },
  code: 'bg-muted block overflow-x-auto rounded-md p-3 font-mono text-sm',
  link: '',
  table: 'my-4 w-full border-collapse overflow-hidden rounded-md text-sm',
  tableScrollableWrapper: 'overflow-x-auto',
  tableCell: 'border border-border px-2 py-1 align-top',
  tableCellHeader: 'border border-border bg-muted px-2 py-1 text-left font-semibold align-top',
};

const markdownHelp = [
  ['# Heading', 'Heading'],
  ['**bold**', 'Bold'],
  ['*italic*', 'Italic'],
  ['- item', 'Bullet list'],
  ['1. item', 'Numbered list'],
  ['- [ ] todo', 'Todo'],
  ['> quote', 'Quote'],
  ['`code`', 'Inline code'],
  ['```', 'Code block'],
  ['[text](url)', 'Link'],
  ['<Image />', 'Image'],
];

const slashMenuItems: { label: string; command: ToolbarCommand }[] = [
  { label: 'Heading 1', command: 'h1' },
  { label: 'Heading 2', command: 'h2' },
  { label: 'Bullet list', command: 'ul' },
  { label: 'Todo list', command: 'todo' },
  { label: 'Quote', command: 'quote' },
  { label: 'Code block', command: 'codeblock' },
];

const getMdxImageAttribute = (attributes: string, name: 'alt' | 'src') => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*\`([^\`]*)\`\\s*\\})`),
  );

  return unescapeMarkdownValue(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
};

const mdxImagesToMarkdown = (value: string) =>
  value.replace(/<Image\b([\s\S]*?)\/>/g, (raw, attributes: string) => {
    const src = getMdxImageAttribute(attributes, 'src');
    const alt = getMdxImageAttribute(attributes, 'alt');

    if (!src) {
      return raw;
    }

    return `![${alt.replace(/]/g, '\\]')}](${src})`;
  });

type SerializedMarkdownImageNode = Spread<
  {
    alt: string;
    previewSrc?: string;
    src: string;
  },
  SerializedLexicalNode
>;

class MarkdownImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  __alt: string;
  __previewSrc: string;

  static getType() {
    return 'markdown-image';
  }

  static clone(node: MarkdownImageNode) {
    return new MarkdownImageNode(node.__src, node.__alt, node.__previewSrc, node.__key);
  }

  static importJSON(serializedNode: SerializedMarkdownImageNode) {
    return $applyNodeReplacement(
      new MarkdownImageNode(serializedNode.src, serializedNode.alt, serializedNode.previewSrc),
    );
  }

  constructor(src: string, alt: string, previewSrc = '', key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__alt = alt;
    this.__previewSrc = previewSrc;
  }

  createDOM(_config: EditorConfig) {
    const element = document.createElement('figure');
    element.className = 'not-prose my-4 flex w-full flex-col items-center';
    return element;
  }

  updateDOM() {
    return false;
  }

  exportJSON(): SerializedMarkdownImageNode {
    return {
      ...super.exportJSON(),
      alt: this.__alt,
      previewSrc: this.__previewSrc,
      src: this.__src,
    };
  }

  getSrc() {
    return this.__src;
  }

  getAltText() {
    return this.__alt;
  }

  getPreviewSrc() {
    return this.__previewSrc;
  }

  setPreviewSrc(previewSrc: string) {
    const writable = this.getWritable();
    writable.__previewSrc = previewSrc;
  }

  setAltText(alt: string) {
    const writable = this.getWritable();
    writable.__alt = alt;
  }

  getTextContent() {
    return formatMdxImage(this.__src, this.__alt);
  }

  isInline() {
    return false;
  }

  decorate() {
    return (
      <MarkdownImageView
        nodeKey={this.__key}
        src={this.__src}
        previewSrc={this.__previewSrc}
        alt={this.__alt}
      />
    );
  }
}

const $isMarkdownImageNode = (node: LexicalNode | null | undefined): node is MarkdownImageNode =>
  node instanceof MarkdownImageNode;

function MarkdownImageView({
  alt,
  nodeKey,
  previewSrc,
  src,
}: {
  alt: string;
  nodeKey: NodeKey;
  previewSrc: string;
  src: string;
}) {
  const [editor] = useLexicalComposerContext();
  const [caption, setCaption] = useState(alt);

  useEffect(() => {
    setCaption(alt);
  }, [alt]);

  const updateCaption = useCallback(
    (value: string) => {
      setCaption(value);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isMarkdownImageNode(node)) {
          node.setAltText(value);
        }
      });
    },
    [editor, nodeKey],
  );

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={previewSrc || src}
        alt={caption}
        className="h-auto w-full max-w-xl rounded-md border border-border"
      />
      <input
        type="text"
        aria-label="Image caption"
        value={caption}
        onChange={event => updateCaption(event.target.value)}
        placeholder="Add image caption"
        className="placeholder:text-muted-foreground/70 focus:border-foreground/50 text-muted-foreground mt-2 w-full max-w-xl border-b border-transparent bg-transparent px-2 pb-1 text-center text-xs outline-none transition-colors"
      />
    </>
  );
}

const $createMarkdownImageNode = (src: string, alt: string, previewSrc = '') =>
  $applyNodeReplacement(new MarkdownImageNode(src, alt, previewSrc));

const nodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  HorizontalRuleNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  MarkdownImageNode,
];

const escapeTableCell = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n+/g, '<br>');

const splitTableRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(cell =>
      cell
        .trim()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/\\\|/g, '|'),
    );

const createEditorTableNode = (rows: string[][]) => {
  const columnCount = Math.max(1, ...rows.map(row => row.length));
  const tableNode = $createTableNode();

  rows.forEach((row, rowIndex) => {
    const rowNode = $createTableRowNode();

    for (let cellIndex = 0; cellIndex < columnCount; cellIndex += 1) {
      const cellNode = $createTableCellNode(
        rowIndex === 0 ? TableCellHeaderStates.COLUMN : TableCellHeaderStates.NO_STATUS,
      );
      const paragraphNode = $createParagraphNode();
      const cellText = row[cellIndex] ?? '';

      if (cellText) {
        paragraphNode.append($createTextNode(cellText));
      }

      cellNode.append(paragraphNode);
      rowNode.append(cellNode);
    }

    tableNode.append(rowNode);
  });

  return tableNode;
};

const getTableRows = (tableNode: TableNode) =>
  tableNode
    .getChildren()
    .filter($isTableRowNode)
    .map(rowNode =>
      rowNode
        .getChildren()
        .filter($isTableCellNode)
        .map(cellNode => escapeTableCell(cellNode.getTextContent().trim())),
    );

const stagedImagePreviewSrcBySrc = new Map<string, string>();

const getImagePreviewMapKeys = (src: string) => {
  const normalized = src.replace(/^\/api\/image\//, '');
  return [src, normalized];
};

const getStagedImagePreviewSrc = (
  src: string,
  localPreviewSrcByImageSrc?: ReadonlyMap<string, string>,
) =>
  getImagePreviewMapKeys(src)
    .map(key => localPreviewSrcByImageSrc?.get(key) ?? stagedImagePreviewSrcBySrc.get(key))
    .find(Boolean) ?? '';

const IMAGE_TRANSFORMER: TextMatchTransformer = {
  dependencies: [MarkdownImageNode],
  export: node => {
    if (!$isMarkdownImageNode(node)) {
      return null;
    }

    return formatMdxImage(node.getSrc(), node.getAltText());
  },
  importRegExp: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/,
  regExp: /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)$/,
  replace: (node, match) => {
    const [, alt, src] = match;
    const imageSrc = unescapeMarkdownValue(src);
    node.replace(
      $createMarkdownImageNode(
        imageSrc,
        unescapeMarkdownValue(alt),
        getStagedImagePreviewSrc(imageSrc),
      ),
    );
  },
  trigger: ')',
  type: 'text-match',
};

const HORIZONTAL_RULE_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: node => ($isHorizontalRuleNode(node) ? '---' : null),
  regExp: /^---$/,
  replace: parentNode => {
    parentNode.replace($createHorizontalRuleNode());
  },
  type: 'element',
};

const TABLE_ROW_REG_EXP = /^\|(.+)\|\s*$/;
const TABLE_DIVIDER_REG_EXP = /^\|(?:\s*:?-{3,}:?\s*\|)+\s*$/;

const TABLE_TRANSFORMER: MultilineElementTransformer = {
  dependencies: [TableNode, TableRowNode, TableCellNode],
  export: node => {
    if (!$isTableNode(node)) {
      return null;
    }

    const rows = getTableRows(node);

    if (rows.length === 0) {
      return null;
    }

    const columnCount = Math.max(1, ...rows.map(row => row.length));
    const normalizedRows = rows.map(row =>
      Array.from({ length: columnCount }, (_, index) => row[index] ?? ''),
    );
    const [header, ...body] = normalizedRows;
    const divider = Array.from({ length: columnCount }, () => '---');

    return [header, divider, ...body].map(row => `| ${row.join(' | ')} |`).join('\n');
  },
  handleImportAfterStartMatch: ({ lines, rootNode, startLineIndex }) => {
    const dividerLine = lines[startLineIndex + 1];

    if (!dividerLine || !TABLE_DIVIDER_REG_EXP.test(dividerLine)) {
      return null;
    }

    const rows = [splitTableRow(lines[startLineIndex])];
    let lineIndex = startLineIndex + 2;

    while (lineIndex < lines.length && TABLE_ROW_REG_EXP.test(lines[lineIndex])) {
      rows.push(splitTableRow(lines[lineIndex]));
      lineIndex += 1;
    }

    rootNode.append(createEditorTableNode(rows));

    return [true, lineIndex - 1];
  },
  regExpStart: TABLE_ROW_REG_EXP,
  replace: () => false,
  type: 'multiline-element',
};

const EDITOR_TRANSFORMERS: Transformer[] = [
  HORIZONTAL_RULE_TRANSFORMER,
  TABLE_TRANSFORMER,
  IMAGE_TRANSFORMER,
  CHECK_LIST,
  ...TRANSFORMERS,
];

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Failed to encode image'));
        return;
      }
      const base64 = reader.result.split(',')[1];
      if (!base64) {
        reject(new Error('Invalid image data'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });

const getStagedImageId = (
  caption: string,
  usedImageIds: Map<string, number>,
  isPathReserved?: (imageId: string) => boolean,
) => {
  const baseImageId = caption || generateEditorImageId();
  const needsSuffix = /^(image|screenshot|clipboard-image)$/i.test(baseImageId);
  const baseWithSuffix = needsSuffix ? `${baseImageId}-${generateEditorImageId()}` : baseImageId;
  let count = usedImageIds.get(baseWithSuffix) ?? 0;
  let imageId = count > 0 ? `${baseWithSuffix}-${count + 1}` : baseWithSuffix;

  while (isPathReserved?.(imageId)) {
    count += 1;
    imageId = `${baseWithSuffix}-${count + 1}`;
  }

  usedImageIds.set(baseWithSuffix, count + 1);

  return imageId;
};

const getClipboardImageFiles = (clipboardData: DataTransfer) =>
  Array.from(clipboardData.items)
    .filter(item => item.kind === 'file' && item.type.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter((file): file is File => Boolean(file));

const registerStagedImagePreviews = (
  previewSrcByImageSrcRef: MutableRefObject<Map<string, string>>,
  images: StagedEditorImage[],
) => {
  images.forEach(image => {
    getImagePreviewMapKeys(image.src).forEach(key => {
      stagedImagePreviewSrcBySrc.set(key, image.previewSrc);
      previewSrcByImageSrcRef.current.set(key, image.previewSrc);
    });
    stagedImagePreviewSrcBySrc.set(image.path, image.previewSrc);
    previewSrcByImageSrcRef.current.set(image.path, image.previewSrc);
  });
};

const applyStagedImagePreviews = (
  node: LexicalNode,
  previewSrcByImageSrc: ReadonlyMap<string, string>,
) => {
  if ($isMarkdownImageNode(node)) {
    const previewSrc = getStagedImagePreviewSrc(node.getSrc(), previewSrcByImageSrc);

    if (previewSrc) {
      node.setPreviewSrc(previewSrc);
    }
    return;
  }

  if ($isElementNode(node)) {
    node.getChildren().forEach(child => applyStagedImagePreviews(child, previewSrcByImageSrc));
  }
};

function MarkdownModeSyncPlugin({
  mode,
  previewSrcByImageSrcRef,
  value,
}: {
  mode: EditorMode;
  previewSrcByImageSrcRef: MutableRefObject<Map<string, string>>;
  value: string;
}) {
  const [editor] = useLexicalComposerContext();
  const previousModeRef = useRef(mode);

  useEffect(() => {
    if (previousModeRef.current === 'markdown' && mode === 'wysiwyg') {
      let cancelled = false;
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }
        editor.update(() => {
          $convertFromMarkdownString(mdxImagesToMarkdown(value || ''), EDITOR_TRANSFORMERS);
          applyStagedImagePreviews($getRoot(), previewSrcByImageSrcRef.current);
        });
      });

      previousModeRef.current = mode;
      return () => {
        cancelled = true;
      };
    }
    previousModeRef.current = mode;
  }, [editor, mode, previewSrcByImageSrcRef, value]);

  return null;
}

function MarkdownChangePlugin({
  mode,
  onChange,
}: {
  mode: EditorMode;
  onChange: (value: string) => void;
}) {
  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (mode !== 'wysiwyg') {
        return;
      }
      editorState.read(() => {
        onChange($convertToMarkdownString(EDITOR_TRANSFORMERS).trimEnd());
      });
    },
    [mode, onChange],
  );

  return <OnChangePlugin onChange={handleChange} />;
}

function EditorRefPlugin({ editorRef }: { editorRef: MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    editorRef.current = editor;
    return () => {
      editorRef.current = null;
    };
  }, [editor, editorRef]);

  return null;
}

const getActiveRangeSelection = () => {
  const selection = $getSelection() ?? $getPreviousSelection();
  if (!$isRangeSelection(selection)) {
    return null;
  }

  const nextSelection = selection.clone();
  $setSelection(nextSelection);
  return nextSelection;
};

const applyTextFormatCommand = (editor: LexicalEditor, format: TextFormatType) => {
  editor.update(() => {
    const selection = getActiveRangeSelection();

    if (selection) {
      selection.formatText(format);
    }
  });
};

const clearCollapsedTextFormatting = () => {
  const selection = getActiveRangeSelection();

  if (selection?.isCollapsed()) {
    selection.format = 0;
    selection.style = '';
  }
};

const applyBlockCommand = (editor: LexicalEditor, command: ToolbarCommand) => {
  editor.update(() => {
    const selection = getActiveRangeSelection();
    if (!selection) {
      return;
    }

    clearCollapsedTextFormatting();

    if (command === 'paragraph') {
      $setBlocksType(selection, () => $createParagraphNode());
      return;
    }

    if (command === 'quote') {
      $setBlocksType(selection, () => $createQuoteNode());
      return;
    }

    if (command === 'codeblock') {
      $setBlocksType(selection, () => $createCodeNode());
      return;
    }

    if (command === 'hr') {
      $insertNodes([$createHorizontalRuleNode(), $createParagraphNode()]);
      return;
    }

    if (command === 'table') {
      $insertNodes([
        createEditorTableNode([
          ['Column', 'Notes'],
          ['', ''],
        ]),
        $createParagraphNode(),
      ]);
      return;
    }

    const tag = command === 'h1' ? 'h1' : command === 'h2' ? 'h2' : 'h3';
    $setBlocksType(selection, () => $createHeadingNode(tag));
  });
};

const normalizeLinkUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return /^(https?:|mailto:|tel:|\/|#)/.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const insertOrToggleLink = (editor: LexicalEditor, rawUrl = 'https://') => {
  const url = normalizeLinkUrl(rawUrl);

  if (!url) {
    return;
  }

  editor.update(() => {
    const selection = getActiveRangeSelection();
    if (!selection) {
      return;
    }

    if (selection.isCollapsed()) {
      const linkNode = $createLinkNode(url);
      linkNode.append($createTextNode(url));
      $insertNodes([linkNode]);
      return;
    }

    $toggleLink(url);
  });
};

const insertEditorImages = (
  editor: LexicalEditor,
  images: Array<{
    alt: string;
    previewSrc?: string;
    src: string;
  }>,
) => {
  editor.update(() => {
    const nodesToInsert: LexicalNode[] = [];

    images.forEach(image => {
      nodesToInsert.push(
        $createMarkdownImageNode(image.src, image.alt, image.previewSrc),
        $createParagraphNode(),
      );
    });

    $insertNodes(nodesToInsert);
  });
};

const focusTextareaRange = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  start: number,
  end = start,
) => {
  requestAnimationFrame(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.focus();
    textarea.setSelectionRange(start, end);
  });
};

const getTextareaSelection = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  fallbackValue: string,
) => {
  const textarea = textareaRef.current;

  if (!textarea) {
    return { end: fallbackValue.length, start: fallbackValue.length };
  }

  return {
    end: textarea.selectionEnd,
    start: textarea.selectionStart,
  };
};

const commitTextareaValue = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  onChange: (value: string) => void,
  nextValue: string,
  selectionStart: number,
  selectionEnd = selectionStart,
) => {
  onChange(nextValue);
  focusTextareaRange(textareaRef, selectionStart, selectionEnd);
};

const getLineRange = (value: string, start: number, end: number) => {
  const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
  const nextBreak = value.indexOf('\n', end);
  const lineEnd = nextBreak === -1 ? value.length : nextBreak;

  return { lineEnd, lineStart };
};

const stripMarkdownBlockPrefix = (line: string) =>
  line.replace(/^(#{1,6}\s+|>\s+|[-*]\s+\[[ xX]\]\s+|[-*]\s+|\d+\.\s+)/, '');

const applyMarkdownLineCommand = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  transform: (line: string, index: number) => string,
) => {
  const { start, end } = getTextareaSelection(textareaRef, value);
  const { lineStart, lineEnd } = getLineRange(value, start, end);
  const selectedBlock = value.slice(lineStart, lineEnd);
  const lines = selectedBlock.split('\n');
  const nextBlock = lines.map(transform).join('\n');
  const nextValue = `${value.slice(0, lineStart)}${nextBlock}${value.slice(lineEnd)}`;
  const delta = nextBlock.length - selectedBlock.length;

  commitTextareaValue(textareaRef, onChange, nextValue, start + delta, end + delta);
};

const wrapMarkdownSelection = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  before: string,
  after: string,
  placeholder: string,
) => {
  const { start, end } = getTextareaSelection(textareaRef, value);
  const selected = value.slice(start, end);
  const text = selected || placeholder;
  const nextValue = `${value.slice(0, start)}${before}${text}${after}${value.slice(end)}`;
  const selectionStart = start + before.length;
  const selectionEnd = selectionStart + text.length;

  commitTextareaValue(textareaRef, onChange, nextValue, selectionStart, selectionEnd);
};

const insertMarkdownBlock = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  block: string,
  selectOffset?: { end: number; start: number },
) => {
  const { start, end } = getTextareaSelection(textareaRef, value);
  const prefix = start > 0 && !value.slice(0, start).endsWith('\n') ? '\n\n' : '';
  const suffix = end < value.length && !value.slice(end).startsWith('\n') ? '\n\n' : '';
  const insertion = `${prefix}${block}${suffix}`;
  const nextValue = `${value.slice(0, start)}${insertion}${value.slice(end)}`;
  const selectionStart = start + prefix.length + (selectOffset?.start ?? insertion.length);
  const selectionEnd = start + prefix.length + (selectOffset?.end ?? insertion.length);

  commitTextareaValue(textareaRef, onChange, nextValue, selectionStart, selectionEnd);
};

const insertMarkdownLink = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  rawUrl: string,
  selectionOverride?: { end: number; start: number },
) => {
  const url = normalizeLinkUrl(rawUrl);

  if (!url) {
    return;
  }

  const selection = selectionOverride ?? getTextareaSelection(textareaRef, value);
  const selected = value.slice(selection.start, selection.end) || 'link';
  const replacement = `[${selected}](${url})`;
  const nextValue = `${value.slice(0, selection.start)}${replacement}${value.slice(selection.end)}`;
  const labelStart = selection.start + 1;
  const labelEnd = labelStart + selected.length;

  commitTextareaValue(textareaRef, onChange, nextValue, labelStart, labelEnd);
};

const insertMarkdownImages = (
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
  markup: string,
  selectionOverride?: { end: number; start: number },
) => {
  const selection = selectionOverride ?? getTextareaSelection(textareaRef, value);
  const needsLeadingBreak = selection.start > 0 && !value.slice(0, selection.start).endsWith('\n');
  const needsTrailingBreak =
    selection.end < value.length && !value.slice(selection.end).startsWith('\n');
  const insertion = `${needsLeadingBreak ? '\n\n' : ''}${markup}${
    needsTrailingBreak ? '\n\n' : ''
  }`;
  const nextValue = `${value.slice(0, selection.start)}${insertion}${value.slice(selection.end)}`;
  const cursor = selection.start + insertion.length;

  commitTextareaValue(textareaRef, onChange, nextValue, cursor);
};

const runMarkdownToolbarCommand = (
  command: ToolbarCommand,
  textareaRef: MutableRefObject<HTMLTextAreaElement | null>,
  value: string,
  onChange: (value: string) => void,
) => {
  if (command === 'paragraph') {
    applyMarkdownLineCommand(textareaRef, value, onChange, line => stripMarkdownBlockPrefix(line));
    return;
  }

  if (command === 'h1' || command === 'h2' || command === 'h3') {
    const level = command === 'h1' ? '# ' : command === 'h2' ? '## ' : '### ';
    applyMarkdownLineCommand(
      textareaRef,
      value,
      onChange,
      line => `${level}${stripMarkdownBlockPrefix(line) || 'Heading'}`,
    );
    return;
  }

  if (command === 'bold') {
    wrapMarkdownSelection(textareaRef, value, onChange, '**', '**', 'bold');
    return;
  }

  if (command === 'italic') {
    wrapMarkdownSelection(textareaRef, value, onChange, '*', '*', 'italic');
    return;
  }

  if (command === 'strike') {
    wrapMarkdownSelection(textareaRef, value, onChange, '~~', '~~', 'strike');
    return;
  }

  if (command === 'code') {
    wrapMarkdownSelection(textareaRef, value, onChange, '`', '`', 'code');
    return;
  }

  if (command === 'ul') {
    applyMarkdownLineCommand(
      textareaRef,
      value,
      onChange,
      line => `- ${stripMarkdownBlockPrefix(line) || 'Item'}`,
    );
    return;
  }

  if (command === 'ol') {
    applyMarkdownLineCommand(
      textareaRef,
      value,
      onChange,
      (line, index) => `${index + 1}. ${stripMarkdownBlockPrefix(line) || 'Item'}`,
    );
    return;
  }

  if (command === 'todo') {
    applyMarkdownLineCommand(
      textareaRef,
      value,
      onChange,
      line => `- [ ] ${stripMarkdownBlockPrefix(line) || 'Todo'}`,
    );
    return;
  }

  if (command === 'quote') {
    applyMarkdownLineCommand(
      textareaRef,
      value,
      onChange,
      line => `> ${stripMarkdownBlockPrefix(line) || 'Quote'}`,
    );
    return;
  }

  if (command === 'codeblock') {
    const { start, end } = getTextareaSelection(textareaRef, value);
    const selected = value.slice(start, end) || 'code';
    const block = `\`\`\`\n${selected}\n\`\`\``;
    insertMarkdownBlock(textareaRef, value, onChange, block, {
      end: 4 + selected.length,
      start: 4,
    });
    return;
  }

  if (command === 'hr') {
    insertMarkdownBlock(textareaRef, value, onChange, '---');
    return;
  }

  if (command === 'table') {
    const table = '| Column | Notes |\n| --- | --- |\n| A | B |';
    insertMarkdownBlock(textareaRef, value, onChange, table);
  }
};

function ToolbarButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={event => event.preventDefault()}
      disabled={disabled}
      data-active={active || undefined}
      title={label}
      aria-label={label}
      className="focus-ring pressable hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground text-muted-foreground hover:text-foreground disabled:text-muted-foreground/40 flex size-8 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="bg-border mx-1 h-5 w-px shrink-0" />;
}

function ToolbarTriggerButton({
  active,
  buttonRef,
  className,
  onClick,
}: {
  active: boolean;
  buttonRef: MutableRefObject<HTMLButtonElement | null>;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      data-active={active || undefined}
      title="Formatting tools"
      aria-label={active ? 'Hide formatting tools' : 'Show formatting tools'}
      className={cn(
        'focus-ring icon-button hover:bg-muted data-[active=true]:bg-muted data-[active=true]:text-foreground text-muted-foreground hover:text-foreground size-8',
        className,
      )}
    >
      <PanelTopIcon className="size-4" />
    </button>
  );
}

function SelectionBubbleButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      onMouseDown={event => event.preventDefault()}
      className="focus-ring-overlay hover:bg-background/10 text-background/75 hover:text-background flex size-7 items-center justify-center rounded-full transition-[transform,color,background-color] duration-150 ease-(--ease-out) active:scale-[0.97]"
    >
      {children}
    </button>
  );
}

function EditorToolbar({
  mode,
  markdownTextareaRef,
  markdownValue,
  onMarkdownChange,
  onModeChange,
  onUploadImage,
  chrome = 'panel',
  detached = false,
  compact = false,
}: {
  mode: EditorMode;
  markdownTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  markdownValue: string;
  onMarkdownChange: (value: string) => void;
  onModeChange: (mode: EditorMode) => void;
  onUploadImage: () => void;
  chrome?: 'panel' | 'seamless';
  detached?: boolean;
  compact?: boolean;
}) {
  const [editor] = useLexicalComposerContext();
  const linkButtonRef = useRef<HTMLDivElement>(null);
  const linkPanelRef = useRef<HTMLFormElement>(null);
  const [isLinkPanelOpen, setIsLinkPanelOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPanelPortal, setLinkPanelPortal] = useState<HTMLElement | null>(null);
  const [linkPanelPosition, setLinkPanelPosition] = useState<CSSProperties>({});
  const markdownLinkSelectionRef = useRef<{ end: number; start: number } | null>(null);

  const closeLinkPanel = useCallback(() => {
    setIsLinkPanelOpen(false);
    setLinkUrl('');
    markdownLinkSelectionRef.current = null;
  }, []);

  const updateLinkPanelPosition = useCallback(() => {
    const anchor = linkButtonRef.current;
    const rect = anchor?.getBoundingClientRect();

    if (!anchor || !rect) {
      return;
    }

    const drawer = anchor.closest<HTMLElement>('[data-vaul-drawer]');
    if (drawer) {
      const drawerRect = drawer.getBoundingClientRect();
      const panelWidth = Math.min(320, Math.max(240, drawerRect.width - 24));
      const belowTop = rect.bottom - drawerRect.top + 10;
      const aboveTop = rect.top - drawerRect.top - 58;
      const hasRoomBelow = rect.bottom + 52 < Math.min(window.innerHeight, drawerRect.bottom);

      setLinkPanelPortal(drawer);
      setLinkPanelPosition({
        left: Math.max(
          12,
          Math.min(drawerRect.width - panelWidth - 12, rect.right - drawerRect.left - panelWidth),
        ),
        position: 'absolute',
        top: hasRoomBelow ? belowTop : Math.max(12, aboveTop),
        width: panelWidth,
      });
      return;
    }

    if (typeof document !== 'undefined') {
      const panelWidth = Math.min(320, window.innerWidth - 24);
      const belowTop = rect.bottom + 10;
      const aboveTop = rect.top - 58;
      const hasRoomBelow = belowTop + 52 < window.innerHeight;

      setLinkPanelPortal(document.body);
      setLinkPanelPosition({
        left: Math.max(12, Math.min(window.innerWidth - panelWidth - 12, rect.right - panelWidth)),
        position: 'fixed',
        top: hasRoomBelow ? belowTop : Math.max(12, aboveTop),
        width: panelWidth,
      });
    }
  }, []);

  const openLinkPanel = () => {
    if (isLinkPanelOpen) {
      closeLinkPanel();
      return;
    }

    updateLinkPanelPosition();

    if (mode === 'markdown') {
      markdownLinkSelectionRef.current = getTextareaSelection(markdownTextareaRef, markdownValue);
    }

    setIsLinkPanelOpen(true);
  };

  useEffect(() => {
    if (!isLinkPanelOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (linkPanelRef.current?.contains(target) || linkButtonRef.current?.contains(target)) {
        return;
      }

      closeLinkPanel();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeLinkPanel();
      }
    };

    const handleReposition = () => updateLinkPanelPosition();

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [closeLinkPanel, isLinkPanelOpen, updateLinkPanelPosition]);

  const submitLink = () => {
    if (!linkUrl.trim()) {
      return;
    }

    if (mode === 'markdown') {
      insertMarkdownLink(
        markdownTextareaRef,
        markdownValue,
        onMarkdownChange,
        linkUrl,
        markdownLinkSelectionRef.current ?? undefined,
      );
      markdownLinkSelectionRef.current = null;
    } else {
      insertOrToggleLink(editor, linkUrl);
    }
    closeLinkPanel();
  };

  const run = (command: ToolbarCommand) => {
    if (command === 'image') {
      onUploadImage();
      return;
    }

    if (mode === 'markdown') {
      if (command === 'link') {
        openLinkPanel();
        return;
      }
      runMarkdownToolbarCommand(command, markdownTextareaRef, markdownValue, onMarkdownChange);
      return;
    }

    if (command === 'bold' || command === 'italic' || command === 'code' || command === 'strike') {
      applyTextFormatCommand(editor, command === 'strike' ? 'strikethrough' : command);
      return;
    }

    if (command === 'ul') {
      editor.update(clearCollapsedTextFormatting, { discrete: true });
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (command === 'ol') {
      editor.update(clearCollapsedTextFormatting, { discrete: true });
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
      return;
    }

    if (command === 'todo') {
      editor.update(clearCollapsedTextFormatting, { discrete: true });
      editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
      return;
    }

    if (command === 'link') {
      openLinkPanel();
      return;
    }

    applyBlockCommand(editor, command);
  };

  return (
    <>
      <div
        className={cn(
          'bg-background/95 border-border flex items-center gap-0.5 overflow-x-auto backdrop-blur',
          chrome === 'panel' && 'border-b px-2 py-2',
          chrome === 'seamless' &&
            'not-prose rounded-lg border px-1.5 py-1.5 shadow-sm supports-[backdrop-filter]:bg-background/80',
          chrome === 'seamless' && detached && 'max-w-full',
          compact && 'rounded-t-lg border',
        )}
      >
        <ToolbarButton
          label="WYSIWYG"
          onClick={() => onModeChange('wysiwyg')}
          active={mode === 'wysiwyg'}
        >
          <EyeIcon className={cn('size-4', mode === 'wysiwyg' && 'text-foreground')} />
        </ToolbarButton>
        <ToolbarButton
          label="Markdown"
          onClick={() => onModeChange('markdown')}
          active={mode === 'markdown'}
        >
          <TextIcon className={cn('size-4', mode === 'markdown' && 'text-foreground')} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Paragraph" onClick={() => run('paragraph')}>
          <PilcrowIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 1" onClick={() => run('h1')}>
          <Heading1Icon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 2" onClick={() => run('h2')}>
          <Heading2Icon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Heading 3" onClick={() => run('h3')}>
          <Heading3Icon className="size-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Bold" onClick={() => run('bold')}>
          <BoldIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" onClick={() => run('italic')}>
          <ItalicIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" onClick={() => run('strike')}>
          <StrikethroughIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Inline code" onClick={() => run('code')}>
          <CodeIcon className="size-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Bullet list" onClick={() => run('ul')}>
          <ListIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" onClick={() => run('ol')}>
          <ListOrderedIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Todo list" onClick={() => run('todo')}>
          <CheckSquareIcon className="size-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton label="Quote" onClick={() => run('quote')}>
          <QuoteIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Code block" onClick={() => run('codeblock')}>
          <PanelTopIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Divider" onClick={() => run('hr')}>
          <MinusIcon className="size-4" />
        </ToolbarButton>
        <ToolbarDivider />
        <div ref={linkButtonRef} className="shrink-0">
          <ToolbarButton label="Link" onClick={() => run('link')}>
            <LinkIcon className="size-4" />
          </ToolbarButton>
        </div>
        <ToolbarButton label="Upload image" onClick={() => run('image')}>
          <ImagePlusIcon className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Table" onClick={() => run('table')}>
          <TableIcon className="size-4" />
        </ToolbarButton>
      </div>
      {isLinkPanelOpen && linkPanelPortal
        ? createPortal(
            <form
              ref={linkPanelRef}
              data-editor-link-panel="true"
              className="bg-background border-border pointer-events-auto z-[70] flex items-center gap-1.5 rounded-lg border p-1.5 shadow-lg"
              style={linkPanelPosition}
              onKeyDownCapture={event => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  closeLinkPanel();
                }
              }}
              onSubmit={event => {
                event.preventDefault();
                submitLink();
              }}
            >
              <input
                name="editor-link-url"
                autoFocus
                value={linkUrl}
                onChange={event => setLinkUrl(event.target.value)}
                className="border-border bg-background placeholder:text-muted-foreground min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-sm outline-none focus:border-current"
                aria-label="Link URL"
                placeholder="Paste link"
              />
              <button
                type="submit"
                disabled={!linkUrl.trim()}
                className="focus-ring pressable bg-foreground text-background disabled:bg-muted disabled:text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md disabled:cursor-not-allowed"
                aria-label="Apply link"
              >
                <CheckIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={closeLinkPanel}
                className="focus-ring pressable hover:bg-muted text-muted-foreground hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
                aria-label="Close link panel"
              >
                <XIcon className="size-4" />
              </button>
            </form>,
            linkPanelPortal,
          )
        : null}
    </>
  );
}

function SlashMenuPlugin() {
  const [editor] = useLexicalComposerContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState({ top: 56, left: 12 });
  const menuRef = useRef<HTMLDivElement | null>(null);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.toLowerCase();

    return slashMenuItems.filter(item => item.label.toLowerCase().includes(normalizedQuery));
  }, [query]);

  const getSlashQuery = useCallback(() => {
    const selection = $getSelection();

    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchorNode = selection.anchor.getNode();

    if (!$isTextNode(anchorNode)) {
      return null;
    }

    const textBeforeCursor = anchorNode.getTextContent().slice(0, selection.anchor.offset);
    const match = textBeforeCursor.match(/(?:^|\s)\/([A-Za-z0-9_-]*)$/);

    return match ? match[1] : null;
  }, []);

  const updatePosition = useCallback(() => {
    const root = editor.getRootElement();
    const container = root?.parentElement;
    const selection = window.getSelection();

    if (!root || !container || !selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0).cloneRange();

    if (
      selection.isCollapsed &&
      selection.anchorNode?.nodeType === Node.TEXT_NODE &&
      selection.anchorOffset > 0
    ) {
      range.setStart(selection.anchorNode, selection.anchorOffset - 1);
    }

    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const menuWidth = 208;
    const left = Math.max(
      8,
      Math.min(container.clientWidth - menuWidth - 8, rect.left - containerRect.left),
    );
    const top = Math.max(8, rect.bottom - containerRect.top + container.scrollTop + 8);

    setPosition({ left, top });
  }, [editor]);

  const removeSlashTrigger = useCallback(() => {
    editor.update(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const offset = selection.anchor.offset;

      if ($isTextNode(anchorNode) && offset > 0) {
        const textBeforeCursor = anchorNode.getTextContent().slice(0, offset);
        const match = textBeforeCursor.match(/(?:^|\s)\/[A-Za-z0-9_-]*$/);

        if (match?.index !== undefined) {
          anchorNode.spliceText(match.index, textBeforeCursor.length - match.index, '', true);
        }
      }
    });
  }, [editor]);

  const run = useCallback(
    (command: ToolbarCommand) => {
      removeSlashTrigger();
      window.requestAnimationFrame(() => applyBlockCommand(editor, command));
      setOpen(false);
    },
    [editor, removeSlashTrigger],
  );

  const openMenu = useCallback(() => {
    editor.getEditorState().read(() => {
      const nextQuery = getSlashQuery();

      if (nextQuery === null) {
        setOpen(false);
        return;
      }

      setQuery(nextQuery);
      setActiveIndex(0);
      updatePosition();
      setOpen(true);
    });
  }, [editor, getSlashQuery, updatePosition]);

  const closeMenu = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }, []);

  const syncMenuFromSelection = useCallback(() => {
    editor.getEditorState().read(() => {
      const nextQuery = getSlashQuery();

      if (nextQuery === null) {
        closeMenu();
        return;
      }

      const nextItems = slashMenuItems.filter(item =>
        item.label.toLowerCase().includes(nextQuery.toLowerCase()),
      );

      if (nextItems.length === 0) {
        closeMenu();
        return;
      }

      setQuery(nextQuery);
      setActiveIndex(index => Math.min(index, nextItems.length - 1));
      updatePosition();
    });
  }, [closeMenu, editor, getSlashQuery, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const root = editor.getRootElement();
    const container = root?.parentElement;

    if (!container) {
      return;
    }

    container.addEventListener('scroll', updatePosition);
    return () => container.removeEventListener('scroll', updatePosition);
  }, [editor, open, updatePosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    return editor.registerUpdateListener(() => {
      syncMenuFromSelection();
    });
  }, [editor, open, syncMenuFromSelection]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      closeMenu();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [closeMenu, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const root = editor.getRootElement();
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (target instanceof Node && (root?.contains(target) || menuRef.current?.contains(target))) {
        return;
      }

      closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [closeMenu, editor, open]);

  useEffect(() => {
    const root = editor.getRootElement();

    if (!root) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/') {
        window.setTimeout(openMenu, 0);
      }

      if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
        window.setTimeout(syncMenuFromSelection, 0);
      }
    };

    root.addEventListener('keydown', handleKeyDown);
    return () => root.removeEventListener('keydown', handleKeyDown);
  }, [editor, openMenu, syncMenuFromSelection]);

  useEffect(() => {
    return editor.registerCommand<KeyboardEvent>(
      KEY_DOWN_COMMAND,
      event => {
        if (open) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            event.stopPropagation();
            if (filteredItems.length === 0) {
              closeMenu();
              return true;
            }
            setActiveIndex(index => (index + 1) % filteredItems.length);
            return true;
          }

          if (event.key === 'ArrowUp') {
            event.preventDefault();
            event.stopPropagation();
            if (filteredItems.length === 0) {
              closeMenu();
              return true;
            }
            setActiveIndex(index => (index - 1 + filteredItems.length) % filteredItems.length);
            return true;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();
            const item = filteredItems[activeIndex];

            if (item) {
              run(item.command);
            }
            return true;
          }

          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            closeMenu();
            return true;
          }

          window.setTimeout(syncMenuFromSelection, 0);
        }

        if (event.key === '/') {
          window.setTimeout(openMenu, 0);
        }

        if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
          window.setTimeout(syncMenuFromSelection, 0);
        }

        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [activeIndex, closeMenu, editor, filteredItems, open, openMenu, run, syncMenuFromSelection]);

  if (!open || filteredItems.length === 0) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      data-editor-slash-menu="true"
      className="bg-background border-border absolute z-10 w-52 rounded-lg border p-1 shadow-lg"
      style={{ top: position.top, left: position.left }}
      role="menu"
      aria-label="Slash commands"
    >
      {filteredItems.map((item, index) => (
        <button
          key={item.command}
          type="button"
          role="menuitem"
          onMouseDown={event => event.preventDefault()}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => run(item.command)}
          className={cn(
            'flex w-full rounded-md px-3 py-2 text-left text-sm',
            index === activeIndex ? 'bg-muted text-foreground' : 'hover:bg-muted',
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function SelectionBubblePlugin() {
  const [editor] = useLexicalComposerContext();
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const update = () => {
      const root = editor.getRootElement();
      const selection = window.getSelection();
      if (!root || !selection || selection.isCollapsed || !selection.anchorNode) {
        setRect(null);
        return;
      }
      if (!root.contains(selection.anchorNode)) {
        setRect(null);
        return;
      }
      const range = selection.getRangeAt(0);
      setRect(range.getBoundingClientRect());
    };

    document.addEventListener('selectionchange', update);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('selectionchange', update);
      window.removeEventListener('resize', update);
    };
  }, [editor]);

  if (!rect) {
    return null;
  }

  const top = Math.max(12, rect.top - 44);
  const bubbleWidth = 68;
  const maxLeft = Math.max(12, window.innerWidth - bubbleWidth - 12);
  const left = Math.max(12, Math.min(maxLeft, rect.left + rect.width / 2 - bubbleWidth / 2));

  return (
    <div
      className="bg-foreground/95 text-background fixed z-50 flex items-center gap-0.5 rounded-full p-1 shadow-lg"
      style={{ top, left }}
    >
      <SelectionBubbleButton label="Bold" onClick={() => applyTextFormatCommand(editor, 'bold')}>
        <BoldIcon className="size-4" />
      </SelectionBubbleButton>
      <SelectionBubbleButton
        label="Italic"
        onClick={() => applyTextFormatCommand(editor, 'italic')}
      >
        <ItalicIcon className="size-4" />
      </SelectionBubbleButton>
    </div>
  );
}

export default function MarkdownLexicalEditor({
  value,
  onChange,
  placeholder = 'Write something...',
  uploadScope,
  uploadEntityId,
  className,
  editorClassName,
  editorFooter,
  minHeightClassName = 'min-h-72',
  chrome = 'panel',
  showQuickReference = true,
  showMobileToolbarOverlay = true,
  toolbarPlacement = 'auto',
  toolbarPortal,
  floatingActions,
  insertUploadedImages = true,
  onImagesStaged,
}: IMarkdownLexicalEditorProps) {
  const [mode, setMode] = useState<EditorMode>('wysiwyg');
  const [isStagingImages, setIsStagingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const markdownUploadSelectionRef = useRef<{ end: number; start: number } | null>(null);
  const toolbarTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileToolbarTriggerRef = useRef<HTMLButtonElement | null>(null);
  const dockedToolbarTriggerRef = useRef<HTMLButtonElement | null>(null);
  const toolbarPopoverRef = useRef<HTMLDivElement | null>(null);
  const previewSrcByImageSrcRef = useRef(new Map<string, string>());
  const stagedImageIdsRef = useRef(new Map<string, number>());
  const [isToolbarOpen, setIsToolbarOpen] = useState(false);
  const [isToolbarAnchorVisible, setIsToolbarAnchorVisible] = useState(true);
  const [toolbarPopoverPortal, setToolbarPopoverPortal] = useState<HTMLElement | null>(null);
  const [toolbarPopoverStyle, setToolbarPopoverStyle] = useState<CSSProperties>({});

  useEffect(() => {
    setToolbarPopoverPortal(document.body);
  }, []);

  const handleModeChange = useCallback(
    (nextMode: EditorMode) => {
      if (nextMode === mode) {
        return;
      }

      if (mode === 'wysiwyg' && nextMode === 'markdown' && editorRef.current) {
        editorRef.current.getEditorState().read(() => {
          onChange(normalizeEditorImageMarkup($convertToMarkdownString(EDITOR_TRANSFORMERS)));
        });
      } else if (nextMode === 'markdown') {
        onChange(normalizeEditorImageMarkup(value));
      }

      setMode(nextMode);
    },
    [mode, onChange, value],
  );

  const initialConfig = useMemo(
    () => ({
      namespace: `FaizMarkdownEditor:${uploadScope}:${uploadEntityId}`,
      theme,
      nodes,
      editorState: () => {
        $convertFromMarkdownString(mdxImagesToMarkdown(value || ''), EDITOR_TRANSFORMERS);
        applyStagedImagePreviews($getRoot(), previewSrcByImageSrcRef.current);
      },
      onError(error: Error) {
        console.error(error);
      },
    }),
    [uploadEntityId, uploadScope, value],
  );

  const stageImageFiles = useCallback(
    (
      files: File[],
      selectionOverride?: {
        end: number;
        start: number;
      },
    ) => {
      if (!files.length) {
        return;
      }

      const activeMode = mode;
      const activeMarkdownValue = value;

      setIsStagingImages(true);
      const stageFiles = async () => {
        const inserted: StagedEditorImage[] = [];

        for (const [index, file] of files.entries()) {
          if (
            !SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])
          ) {
            throw new Error(`Unsupported format: ${file.name}`);
          }
          if (file.size > MAX_IMAGE_SIZE) {
            throw new Error(`File too large: ${file.name}`);
          }

          const compressed = await compressImage(file);
          const imageBase64 = await fileToBase64(compressed);
          const alt = getImageCaptionFromFilename(file.name, `image-${index + 1}`);
          const imageId = getStagedImageId(alt, stagedImageIdsRef.current, candidateImageId => {
            const candidatePath = buildEditorImageStoragePath({
              entityId: uploadEntityId,
              imageId: candidateImageId,
              scope: uploadScope,
            });

            return (
              activeMarkdownValue.includes(candidatePath) ||
              activeMarkdownValue.includes(toApiImageUrl(candidatePath))
            );
          });
          const path = buildEditorImageStoragePath({
            entityId: uploadEntityId,
            imageId,
            scope: uploadScope,
          });
          const src = toApiImageUrl(path);
          const previewSrc = `data:image/webp;base64,${imageBase64}`;

          inserted.push({
            alt,
            markup: formatMdxImage(src, alt),
            fileName: file.name,
            imageBase64,
            imageId,
            mimeType: 'image/webp',
            path,
            previewSrc,
            scope: uploadScope,
            src,
            uploadEntityId,
          });
        }

        return inserted;
      };

      toast.promise(stageFiles(), {
        loading: 'Preparing image...',
        success: inserted => {
          registerStagedImagePreviews(previewSrcByImageSrcRef, inserted);
          onImagesStaged?.(inserted);
          if (!insertUploadedImages) {
            markdownUploadSelectionRef.current = null;
            return inserted.length > 1 ? 'Images attached' : 'Image attached';
          }

          const markup = inserted.map(image => image.markup).join('\n');
          if (activeMode === 'wysiwyg' && editorRef.current) {
            insertEditorImages(editorRef.current, inserted);
          } else {
            insertMarkdownImages(
              markdownTextareaRef,
              activeMarkdownValue,
              onChange,
              markup,
              selectionOverride ?? markdownUploadSelectionRef.current ?? undefined,
            );
            markdownUploadSelectionRef.current = null;
          }
          return inserted.length > 1 ? 'Images ready' : 'Image ready';
        },
        error: error => error.message || 'Image failed',
        finally: () => setIsStagingImages(false),
      });
    },
    [insertUploadedImages, mode, onChange, onImagesStaged, uploadEntityId, uploadScope, value],
  );

  const handleUploadClick = () => {
    if (mode === 'markdown') {
      markdownUploadSelectionRef.current = getTextareaSelection(markdownTextareaRef, value);
    }
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    stageImageFiles(files, markdownUploadSelectionRef.current ?? undefined);
  };

  const handleImagePaste = (event: React.ClipboardEvent) => {
    const files = getClipboardImageFiles(event.clipboardData);
    if (!files.length) {
      return;
    }

    event.preventDefault();
    stageImageFiles(
      files,
      mode === 'markdown' ? getTextareaSelection(markdownTextareaRef, value) : undefined,
    );
  };

  const renderToolbar = (compact = false) => (
    <EditorToolbar
      mode={mode}
      chrome={chrome}
      detached={chrome === 'seamless'}
      markdownTextareaRef={markdownTextareaRef}
      markdownValue={value}
      onMarkdownChange={onChange}
      onModeChange={handleModeChange}
      onUploadImage={handleUploadClick}
      compact={compact}
    />
  );
  const shouldPortalToolbar = chrome === 'seamless' && !!toolbarPortal;

  const getVisibleToolbarAnchor = useCallback(() => {
    const anchors = [
      dockedToolbarTriggerRef.current,
      toolbarTriggerRef.current,
      mobileToolbarTriggerRef.current,
    ];
    return (
      anchors.find(anchor => {
        if (!anchor) {
          return false;
        }

        const rect = anchor.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }) ?? null
    );
  }, []);

  const updateToolbarPopoverPosition = useCallback(() => {
    const anchor = getVisibleToolbarAnchor();

    if (!anchor) {
      return;
    }

    if (window.innerWidth < 768) {
      setToolbarPopoverStyle({
        bottom: 76,
        left: 12,
        position: 'fixed',
        right: 12,
      });
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = Math.min(680, window.innerWidth - 24);
    const left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.right - width));
    const belowTop = rect.bottom + 10;
    const aboveTop = rect.top - 50;
    const hasRoomAbove = aboveTop >= 12;
    const top = toolbarPlacement === 'below' || !hasRoomAbove ? belowTop : aboveTop;

    setToolbarPopoverStyle({
      left,
      position: 'fixed',
      top: Math.max(12, Math.min(window.innerHeight - 54, top)),
      width,
    });
  }, [getVisibleToolbarAnchor, toolbarPlacement]);

  const toggleToolbar = useCallback(() => {
    setIsToolbarOpen(open => {
      const nextOpen = !open;
      if (nextOpen) {
        window.requestAnimationFrame(updateToolbarPopoverPosition);
      }
      return nextOpen;
    });
  }, [updateToolbarPopoverPosition]);

  useEffect(() => {
    if (!isToolbarOpen) {
      return;
    }

    window.requestAnimationFrame(updateToolbarPopoverPosition);

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (
        toolbarPopoverRef.current?.contains(target) ||
        toolbarTriggerRef.current?.contains(target) ||
        dockedToolbarTriggerRef.current?.contains(target) ||
        mobileToolbarTriggerRef.current?.contains(target)
      ) {
        return;
      }

      setIsToolbarOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsToolbarOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', updateToolbarPopoverPosition);
    window.addEventListener('scroll', updateToolbarPopoverPosition, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('resize', updateToolbarPopoverPosition);
      window.removeEventListener('scroll', updateToolbarPopoverPosition, true);
    };
  }, [isToolbarOpen, updateToolbarPopoverPosition]);

  useEffect(() => {
    if (!shouldPortalToolbar || !showMobileToolbarOverlay) {
      setIsToolbarAnchorVisible(true);
      return;
    }

    const updateToolbarAnchorVisibility = () => {
      const anchor = toolbarTriggerRef.current;
      if (!anchor) {
        setIsToolbarAnchorVisible(true);
        return;
      }

      const rect = anchor.getBoundingClientRect();
      setIsToolbarAnchorVisible(rect.bottom > 0 && rect.top < window.innerHeight);
    };

    updateToolbarAnchorVisibility();
    window.addEventListener('resize', updateToolbarAnchorVisibility);
    window.addEventListener('scroll', updateToolbarAnchorVisibility, true);

    return () => {
      window.removeEventListener('resize', updateToolbarAnchorVisibility);
      window.removeEventListener('scroll', updateToolbarAnchorVisibility, true);
    };
  }, [shouldPortalToolbar, showMobileToolbarOverlay]);

  const toolbarTrigger = (
    <ToolbarTriggerButton
      active={isToolbarOpen}
      buttonRef={toolbarTriggerRef}
      onClick={toggleToolbar}
    />
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
        {chrome === 'panel' ? renderToolbar() : null}
        {shouldPortalToolbar ? createPortal(toolbarTrigger, toolbarPortal) : null}
        <div
          className={cn(
            'relative min-h-0 flex-1 overflow-auto',
            chrome === 'panel' && 'border-border',
            chrome === 'panel' && (editorFooter ? '' : 'border-b'),
          )}
        >
          <EditorRefPlugin editorRef={editorRef} />
          {mode === 'wysiwyg' ? (
            <>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    aria-placeholder={placeholder}
                    placeholder={
                      <div
                        className={cn(
                          'text-muted-foreground pointer-events-none absolute',
                          chrome === 'panel' ? 'top-4 left-4' : 'top-0 left-0',
                        )}
                      >
                        {placeholder}
                      </div>
                    }
                    className={cn(
                      'prose dark:prose-invert text-base leading-7 outline-none',
                      chrome === 'panel' ? 'max-w-none px-4 py-4' : 'px-0 py-0',
                      minHeightClassName,
                      editorClassName,
                    )}
                    onPaste={handleImagePaste}
                  />
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <CheckListPlugin />
              <LinkPlugin />
              <HorizontalRulePlugin />
              <TablePlugin hasHorizontalScroll />
              <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
              <MarkdownModeSyncPlugin
                mode={mode}
                previewSrcByImageSrcRef={previewSrcByImageSrcRef}
                value={value}
              />
              <MarkdownChangePlugin mode={mode} onChange={onChange} />
              <SlashMenuPlugin />
              <SelectionBubblePlugin />
            </>
          ) : (
            <textarea
              ref={markdownTextareaRef}
              name="editor-markdown"
              aria-label={placeholder}
              value={value}
              onChange={event => onChange(event.target.value)}
              onPaste={handleImagePaste}
              placeholder={placeholder}
              className={cn(
                'placeholder:text-muted-foreground w-full resize-none bg-transparent font-mono text-sm leading-6 outline-none',
                chrome === 'panel' ? 'px-4 py-4' : 'px-0 py-0',
                minHeightClassName,
              )}
            />
          )}
        </div>

        {editorFooter}

        {showQuickReference && (
          <details className="border-border bg-background group border-b px-4 py-3 text-sm">
            <summary className="text-muted-foreground hover:text-foreground cursor-pointer list-none">
              Markdown quick reference
            </summary>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-3">
              {markdownHelp.map(([syntax, label]) => (
                <div key={syntax} className="flex flex-col gap-0.5">
                  <code className="bg-muted rounded px-1.5 py-1 font-mono text-xs">{syntax}</code>
                  <span className="text-muted-foreground text-xs">{label}</span>
                </div>
              ))}
            </div>
          </details>
        )}

        {shouldPortalToolbar && showMobileToolbarOverlay && (
          <div className="fixed right-3 bottom-3 z-50 md:hidden">
            <div className="bg-background/90 border-border flex max-w-[calc(100vw-1.5rem)] items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur">
              <ToolbarTriggerButton
                active={isToolbarOpen}
                buttonRef={mobileToolbarTriggerRef}
                onClick={toggleToolbar}
              />
              {floatingActions}
            </div>
          </div>
        )}

        {shouldPortalToolbar && showMobileToolbarOverlay && !isToolbarAnchorVisible && (
          <div className="pointer-events-none fixed top-3 right-3 z-50 hidden md:flex">
            <div className="bg-background/90 border-border pointer-events-auto flex items-center gap-1 rounded-lg border p-1 shadow-lg backdrop-blur">
              <ToolbarTriggerButton
                active={isToolbarOpen}
                buttonRef={dockedToolbarTriggerRef}
                onClick={toggleToolbar}
              />
              {floatingActions}
            </div>
          </div>
        )}

        {isToolbarOpen && toolbarPopoverPortal
          ? createPortal(
              <div
                ref={toolbarPopoverRef}
                className="not-prose pointer-events-auto z-[70]"
                style={toolbarPopoverStyle}
              >
                {renderToolbar(true)}
              </div>,
              toolbarPopoverPortal,
            )
          : null}

        {chrome === 'panel' && (
          <div className="sticky bottom-0 z-10 md:hidden">
            <EditorToolbar
              mode={mode}
              chrome={chrome}
              markdownTextareaRef={markdownTextareaRef}
              markdownValue={value}
              onMarkdownChange={onChange}
              onModeChange={handleModeChange}
              onUploadImage={handleUploadClick}
              compact
            />
          </div>
        )}

        {isStagingImages && (
          <div className="text-muted-foreground bg-background/80 absolute right-3 bottom-3 rounded-full border px-3 py-1 text-xs backdrop-blur">
            Preparing...
          </div>
        )}

        <input
          ref={fileInputRef}
          name={`${uploadScope}-editor-image`}
          aria-label="Editor image file"
          type="file"
          accept={SUPPORTED_IMAGE_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
    </LexicalComposer>
  );
}
