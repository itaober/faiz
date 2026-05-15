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
  imageId,
  scope,
}: {
  entityId: string;
  imageId: string;
  scope: EditorImageScope;
}) => {
  const safeEntityId = sanitizeImageSegment(entityId) || 'content';
  const safeImageId = sanitizeImageSegment(imageId) || generateEditorImageId();

  return `assets/${scope}/${safeEntityId}_${safeImageId}.webp`;
};

export const toApiImageUrl = (storagePath: string) => `/api/image/${storagePath}`;

export const unescapeMarkdownValue = (value: string) =>
  value.replace(/\\([\\`*_{}[\]()#+\-.!_>])/g, '$1');

export const getImageCaptionFromFilename = (filename: string, fallback = 'image') =>
  unescapeMarkdownValue(filename.replace(/\.[^.]+$/, '').trim()) || fallback;

export const escapeMdxAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export const formatMdxImage = (src: string, alt: string) =>
  `<Image src="${escapeMdxAttribute(unescapeMarkdownValue(src))}" alt="${escapeMdxAttribute(
    unescapeMarkdownValue(alt),
  )}" />`;

export const updateStagedEditorImageCaption = (
  image: StagedEditorImage,
  caption: string,
  imageIdOverride?: string,
): StagedEditorImage => {
  const alt = unescapeMarkdownValue(caption.trim());
  const imageId = imageIdOverride || alt || image.imageId || 'image';
  const path = buildEditorImageStoragePath({
    entityId: image.uploadEntityId,
    imageId,
    scope: image.scope,
  });
  const src = toApiImageUrl(path);

  return {
    ...image,
    alt,
    imageId,
    markup: formatMdxImage(src, alt),
    path,
    src,
  };
};

const getMdxImageAttribute = (attributes: string, name: 'alt' | 'src') => {
  const match = attributes.match(
    new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*\`([^\`]*)\`\\s*\\})`),
  );

  return unescapeMarkdownValue(match?.[1] ?? match?.[2] ?? match?.[3] ?? '');
};

const normalizeMdxImageTags = (value: string) =>
  value.replace(/<Image\b([\s\S]*?)\/>/g, (raw, attributes: string) => {
    const src = getMdxImageAttribute(attributes, 'src');
    const alt = getMdxImageAttribute(attributes, 'alt');

    return src ? formatMdxImage(src, alt) : raw;
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
