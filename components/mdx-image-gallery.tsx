import ImageGallery, { type GalleryImage } from '@/components/image-gallery';
import { isAssetKey, resolveAssetSrc } from '@/lib/assets';
import { getImageMeta } from '@/lib/data/images';
import { type MdxImageGalleryItem, unescapeMarkdownValue } from '@/lib/utils/editor-image';

interface MDXImageGalleryProps {
  images?: Array<MdxImageGalleryItem | string>;
}

const toGalleryImage = async (
  value: MdxImageGalleryItem | string | null | undefined,
): Promise<GalleryImage | null> => {
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
  const items = (await Promise.all((images ?? []).map(toGalleryImage))).filter(
    (image): image is GalleryImage => Boolean(image),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <span className="mb-4 block">
      <ImageGallery items={items} layout="post" />
    </span>
  );
}
