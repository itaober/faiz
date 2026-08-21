export type EditorImageScope = 'memos' | 'posts' | 'pages' | 'records';

export interface StagedEditorImage {
  alt: string;
  fileName: string;
  imageBase64: string;
  imageId: string;
  markup: string;
  mimeType: 'image/webp';
  path: string;
  previewSrc: string;
  scope: EditorImageScope;
  src: string;
  uploadEntityId: string;
}

export interface MdxImageGalleryItem {
  alt?: string;
  caption?: string;
  src: string;
}

type EditorImageExtension = 'webp' | 'jpg' | 'jpeg' | 'png' | 'gif';

export const sanitizeImageSegment = (value: string) =>
  Array.from(
    value
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/-+/g, '-')
      .replace(/^[-_]+|[-_]+$/g, ''),
  )
    .slice(0, 80)
    .join('')
    .trim()
    .replace(/^[-_]+|[-_]+$/g, '');

export const generateEditorImageId = () => Math.random().toString(36).slice(2, 8);

export const buildEditorImageStoragePath = ({
  entityId,
  extension = 'webp',
  imageId,
  scope,
}: {
  entityId: string;
  extension?: EditorImageExtension;
  imageId: string;
  scope: EditorImageScope;
}) => {
  const safeEntityId = sanitizeImageSegment(entityId) || 'content';
  const safeImageId = sanitizeImageSegment(imageId) || generateEditorImageId();

  return `assets/${scope}/${safeEntityId}_${safeImageId}.${extension}`;
};

export const toApiImageUrl = (storagePath: string) => `/api/image/${storagePath}`;

/**
 * Merge freshly-staged images into an existing list, de-duplicated by `path`
 * (a re-upload of the same path replaces the prior entry). `toItem` maps each
 * incoming image to the caller's item shape (identity, or e.g. a memo attachment).
 */
export const mergeByPath = <T extends { path: string }, S extends { path: string }>(
  existing: T[],
  incoming: S[],
  toItem: (image: S) => T,
): T[] => {
  const byPath = new Map<string, T>(existing.map(item => [item.path, item]));
  for (const image of incoming) {
    byPath.set(image.path, toItem(image));
  }
  return [...byPath.values()];
};

export const unescapeMarkdownValue = (value: string) =>
  value.replace(/\\([\\`*_{}[\]()#+\-.!_>])/g, '$1');

export const getImageCaptionFromFilename = (filename: string, fallback = 'image') =>
  unescapeMarkdownValue(filename.replace(/\.[^.]+$/, '').trim()) || fallback;

export const escapeMdxAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

/**
 * Inverse of {@link escapeMdxAttribute}. Without it the pair is asymmetric —
 * `unescapeMarkdownValue` only undoes backslash escapes — so re-saving a caption
 * containing `"` or `&` escaped it again on every save (`&` → `&amp;` →
 * `&amp;amp;`). `&amp;` must be decoded last, or `&amp;quot;` over-decodes to `"`.
 */
export const unescapeMdxAttribute = (value: string) =>
  value.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

export const formatMdxImage = (src: string, alt: string, caption?: string) => {
  const captionAttr = caption?.trim()
    ? ` caption="${escapeMdxAttribute(unescapeMarkdownValue(caption))}"`
    : '';
  return `<Image src="${escapeMdxAttribute(unescapeMarkdownValue(src))}" alt="${escapeMdxAttribute(
    unescapeMarkdownValue(alt),
  )}"${captionAttr} />`;
};

const getMdxImageAttribute = (attributes: string, name: string) => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*\`([^\`]*)\`\\s*\\})`),
  );

  return unescapeMdxAttribute(unescapeMarkdownValue(match?.[1] ?? match?.[2] ?? match?.[3] ?? ''));
};

const normalizeGalleryImageItem = (value: unknown): MdxImageGalleryItem | null => {
  if (typeof value === 'string') {
    const src = unescapeMarkdownValue(value).trim();
    return src ? { src } : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const item = value as Record<string, unknown>;
  const src = typeof item.src === 'string' ? unescapeMarkdownValue(item.src).trim() : '';
  if (!src) {
    return null;
  }

  const alt = typeof item.alt === 'string' ? unescapeMarkdownValue(item.alt).trim() : '';
  const caption =
    typeof item.caption === 'string' ? unescapeMarkdownValue(item.caption).trim() : '';

  return {
    src,
    ...(alt ? { alt } : {}),
    ...(caption ? { caption } : {}),
  };
};

const normalizeGalleryImages = (images: MdxImageGalleryItem[]) =>
  images
    .map(normalizeGalleryImageItem)
    .filter((item): item is MdxImageGalleryItem => Boolean(item));

export const formatMdxImageGallery = (images: MdxImageGalleryItem[]) => {
  const normalizedImages = normalizeGalleryImages(images);
  return `<ImageGallery images={${JSON.stringify(normalizedImages)}} />`;
};

const extractJsxExpression = (attributes: string, propName: string) => {
  const propMatch = new RegExp(`\\b${propName}\\s*=\\s*\\{`).exec(attributes);
  if (!propMatch) {
    return '';
  }

  const start = propMatch.index + propMatch[0].lastIndexOf('{');
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let escaped = false;

  for (let index = start; index < attributes.length; index += 1) {
    const char = attributes[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        return attributes.slice(start + 1, index).trim();
      }
    }
  }

  return '';
};

const parseMdxImageGalleryImages = (attributes: string): MdxImageGalleryItem[] => {
  const expression = extractJsxExpression(attributes, 'images');
  if (!expression.startsWith('[')) {
    return [];
  }

  try {
    const parsed = JSON.parse(expression);
    return Array.isArray(parsed)
      ? parsed
          .map(normalizeGalleryImageItem)
          .filter((item): item is MdxImageGalleryItem => Boolean(item))
      : [];
  } catch {
    return [];
  }
};

const parseMdxImageTag = (raw: string): MdxImageGalleryItem | null => {
  const attributes = raw.match(/^<Image\b([\s\S]*?)\/>$/)?.[1] ?? '';
  const src = getMdxImageAttribute(attributes, 'src');

  if (!src) {
    return null;
  }

  const alt = getMdxImageAttribute(attributes, 'alt');
  const caption = getMdxImageAttribute(attributes, 'caption');

  return {
    src,
    ...(alt ? { alt } : {}),
    ...(caption ? { caption } : {}),
  };
};

const normalizeMdxImageTags = (value: string) =>
  value.replace(/<Image\b([\s\S]*?)\/>/g, (raw, attributes: string) => {
    const src = getMdxImageAttribute(attributes, 'src');
    const alt = getMdxImageAttribute(attributes, 'alt');
    const caption = getMdxImageAttribute(attributes, 'caption');

    return src ? formatMdxImage(src, alt, caption) : raw;
  });

const markdownImagesToMdx = (value: string) =>
  value.replace(/!\[([^\]\n]*(?:\\][^\]\n]*)*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, (_, alt, src) =>
    formatMdxImage(src, alt),
  );

const transformOutsideFencedCode = (value: string, transform: (segment: string) => string) => {
  const lines = value.split('\n');
  const result: string[] = [];
  let plainLines: string[] = [];
  let fenceMarker = '';

  const flushPlainLines = () => {
    if (!plainLines.length) {
      return;
    }

    result.push(transform(plainLines.join('\n')));
    plainLines = [];
  };

  lines.forEach(line => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

    if (fenceMarker) {
      result.push(line);
      if (fenceMatch?.[1].startsWith(fenceMarker[0])) {
        fenceMarker = '';
      }
      return;
    }

    if (fenceMatch) {
      flushPlainLines();
      fenceMarker = fenceMatch[1];
      result.push(line);
      return;
    }

    plainLines.push(line);
  });

  flushPlainLines();

  return result.join('\n');
};

export const normalizeEditorImageMarkup = (value: string) =>
  transformOutsideFencedCode(value, segment => markdownImagesToMdx(normalizeMdxImageTags(segment)));

const mdxImageTagPattern = /<Image\b[\s\S]*?\/>/g;
const mdxImageRunPattern = /(?:<Image\b[\s\S]*?\/>\s*){2,}/g;

export const groupConsecutiveMdxImages = (value: string) =>
  transformOutsideFencedCode(value, segment =>
    segment.replace(mdxImageRunPattern, run => {
      const imageTags = run.match(mdxImageTagPattern) ?? [];
      const images = imageTags
        .map(parseMdxImageTag)
        .filter((item): item is MdxImageGalleryItem => Boolean(item));

      if (images.length < 2 || images.length !== imageTags.length) {
        return run;
      }

      return `${formatMdxImageGallery(images)}\n\n`;
    }),
  );

/**
 * Converts MDX `<Image src="" alt="" />` tags back into plain markdown
 * `![alt](src)` so a markdown-based editor can load stored MDX content.
 */
export const mdxImagesToMarkdown = (value: string) =>
  value
    .replace(/<ImageGallery\b([\s\S]*?)\/>/g, (raw, attributes: string) => {
      const images = parseMdxImageGalleryImages(attributes);

      if (!images.length) {
        return raw;
      }

      return images
        .map(image => `![${image.caption || image.alt || ''}](${image.src})`)
        .join('\n\n');
    })
    .replace(/<Image\b([\s\S]*?)\/>/g, (raw, attributes: string) => {
      const src = getMdxImageAttribute(attributes, 'src');
      const alt = getMdxImageAttribute(attributes, 'alt');

      return src ? `![${alt}](${src})` : raw;
    });
