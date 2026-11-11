export type EditorImageScope = 'memos' | 'posts' | 'pages' | 'records';

/** An image compressed in the browser and held in memory until the surface saves. */
export interface StagedEditorImage {
  alt: string;
  /** Asset key the content references; the server derives the same key from the same ids. */
  key: string;
  imageId: string;
  scope: EditorImageScope;
  uploadEntityId: string;
  blob: Blob;
  width: number;
  height: number;
  blur: string;
}

export interface MdxImageGalleryItem {
  alt?: string;
  caption?: string;
  src: string;
}

type EditorImageExtension = 'webp' | 'jpg' | 'jpeg' | 'png' | 'gif';

const MAX_IMAGE_SEGMENT_LENGTH = 80;

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
    .slice(0, MAX_IMAGE_SEGMENT_LENGTH)
    .join('')
    .trim()
    .replace(/^[-_]+|[-_]+$/g, '');

export const generateEditorImageId = () => Math.random().toString(36).slice(2, 8);

/**
 * Image id of a record cover: its readable name plus the upload's suffix. Assets are cached as
 * immutable, so the name gives way to the length cap and the suffix, which keeps keys unique,
 * always survives.
 */
export const coverImageId = (name: string, uploadId: string) =>
  `${Array.from(name)
    .slice(0, MAX_IMAGE_SEGMENT_LENGTH - uploadId.length - 1)
    .join('')}_${uploadId}`;

/** Key of an uploaded image inside this project's assets folder: `{scope}/{entity}_{image}.webp`. */
export const buildAssetKey = ({
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

  return `${scope}/${safeEntityId}_${safeImageId}.${extension}`;
};

/**
 * Merge freshly-staged images into an existing list, de-duplicated by `key`
 * (a re-upload of the same key replaces the prior entry). `toItem` maps each
 * incoming image to the caller's item shape (identity, or e.g. a memo attachment).
 */
export const mergeByKey = <T extends { key: string }, S extends { key: string }>(
  existing: T[],
  incoming: S[],
  toItem: (image: S) => T,
): T[] => {
  const byKey = new Map<string, T>(existing.map(item => [item.key, item]));
  for (const image of incoming) {
    byKey.set(image.key, toItem(image));
  }
  return [...byKey.values()];
};

export const unescapeMarkdownValue = (value: string) =>
  value.replace(/\\([\\`*_{}[\]()#+\-.!_<>])/g, '$1');

/**
 * Markdown for an editor image. Alt and src come from the document, which a paste can fill
 * with anything: a newline or an unescaped `]`/`)` would stop the save from turning it into
 * `<Image>`, leaving its text, `<` included, to be read as JSX.
 */
export const formatMarkdownImage = (src: string, alt: string) => {
  const safeAlt = alt.replace(/\s*[\r\n]+\s*/g, ' ').replace(/[\\\]<]/g, '\\$&');
  const safeSrc = src.replace(/[\s)<]/g, char => (char === ')' ? '%29' : encodeURIComponent(char)));
  return `![${safeAlt}](${safeSrc})`;
};

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

/**
 * Applies `transform` to the text outside fenced code. `rawBlockLines`, when given, also
 * leaves alone the block starting at a line: it returns how many lines that block spans.
 */
export const transformOutsideFencedCode = (
  value: string,
  transform: (segment: string) => string,
  rawBlockLines?: (lines: string[], index: number) => number,
) => {
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

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

    if (fenceMarker) {
      result.push(line);
      if (fenceMatch?.[1].startsWith(fenceMarker[0])) {
        fenceMarker = '';
      }
      continue;
    }

    if (fenceMatch) {
      flushPlainLines();
      fenceMarker = fenceMatch[1];
      result.push(line);
      continue;
    }

    const blockLines = rawBlockLines?.(lines, index) ?? 0;
    if (blockLines > 0) {
      flushPlainLines();
      result.push(...lines.slice(index, index + blockLines));
      index += blockLines - 1;
      continue;
    }

    plainLines.push(line);
  }

  flushPlainLines();

  return result.join('\n');
};

export const normalizeEditorImageMarkup = (value: string) =>
  transformOutsideFencedCode(value, segment => markdownImagesToMdx(normalizeMdxImageTags(segment)));

const mdxImageTagPattern = /<Image\b[\s\S]*?\/>/g;
const mdxImageRunPattern = /(?:<Image\b[^>]*\/>\s*){2,}/g;

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
