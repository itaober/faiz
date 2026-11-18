import MediaStrip, { type MediaItem } from '@/components/media-strip';
import { isAssetKey, resolveAssetSrc } from '@/lib/assets';
import { getImageMeta } from '@/lib/data/images';
import { type MdxImageGalleryItem, unescapeMarkdownValue } from '@/lib/utils/editor-image';

interface MDXImageGalleryProps {
  images?: Array<MdxImageGalleryItem | string>;
}

const toMediaItem = async (
  value: MdxImageGalleryItem | string | null | undefined,
): Promise<MediaItem | null> => {
  const raw = typeof value === 'string' ? value : value?.src;
  const stored = raw ? unescapeMarkdownValue(raw).trim() : '';
  if (!stored) {
    return null;
  }
  const alt =
    typeof value === 'object' && value?.alt ? unescapeMarkdownValue(value.alt).trim() : '';
  const caption =
    typeof value === 'object' && value?.caption ? unescapeMarkdownValue(value.caption).trim() : '';
  const label = alt || caption;
  // A recorded size reserves each slot before its file arrives; legacy URLs have none and size
  // themselves on load.
  const meta = isAssetKey(stored) ? await getImageMeta(stored) : null;
  return {
    src: resolveAssetSrc(stored),
    alt: label || 'Content image',
    caption: label || undefined,
    width: meta?.width,
    height: meta?.height,
    blurDataURL: meta?.blurDataURL,
  };
};

/** Read view for a run of images in a post: the same fixed-height strip memos use. */
export default async function MDXImageGallery({ images }: MDXImageGalleryProps) {
  const items = (await Promise.all((images ?? []).map(toMediaItem))).filter(
    (image): image is MediaItem => Boolean(image),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <span className="mb-4 block">
      <MediaStrip items={items} layout="article" />
    </span>
  );
}
