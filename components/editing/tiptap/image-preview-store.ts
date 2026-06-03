/**
 * Newly-staged images live only in memory until the parent uploads them on save,
 * so their canonical `/api/image/...` src does not resolve yet. We keep a map of
 * canonical src → data-URL preview and swap it in at render time, while markdown
 * serialisation keeps emitting the canonical src.
 */
const previewSrcByRealSrc = new Map<string, string>();

export const registerImagePreview = (realSrc: string, previewSrc: string) => {
  previewSrcByRealSrc.set(realSrc, previewSrc);
};

export const getImagePreviewSrc = (realSrc: string) => previewSrcByRealSrc.get(realSrc);
