import { resolveAssetSrc } from '@/lib/assets';

/**
 * Newly-staged images live only in memory until the parent uploads them on save,
 * so their asset key does not resolve yet. We keep a map of key → object-URL
 * preview and swap it in at render time, while markdown serialisation keeps
 * emitting the key.
 */
const previewSrcByKey = new Map<string, string>();

export const registerImagePreview = (key: string, previewSrc: string) => {
  previewSrcByKey.set(key, previewSrc);
};

/** What an editor `<img>` loads for a stored src: the staged preview, else the public URL. */
export const resolveEditorImageSrc = (src: string) =>
  previewSrcByKey.get(src) ?? resolveAssetSrc(src);
