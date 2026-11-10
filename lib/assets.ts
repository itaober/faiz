/**
 * Public assets live in a bucket served at NEXT_PUBLIC_ASSETS_URL. Content stores only the key
 * inside this project's folder (`memos/x.webp`); the folder and the host are written once, in
 * that URL, so moving domains or folders never touches stored content.
 */

const RAW_ASSETS_URL = (process.env.NEXT_PUBLIC_ASSETS_URL ?? '').replace(/\/+$/, '');
const assetsUrl = RAW_ASSETS_URL ? new URL(RAW_ASSETS_URL) : null;

export const ASSETS_ORIGIN = assetsUrl?.origin ?? '';

/** The project folder inside the shared assets bucket, taken from the URL path. */
export const ASSETS_FOLDER = assetsUrl?.pathname.replace(/^\/+|\/+$/g, '') ?? '';

// Resizing exists only on a Cloudflare zone; an r2.dev address (try-out, local) serves the file as-is.
export const CAN_TRANSFORM_ASSETS = Boolean(assetsUrl) && !assetsUrl?.hostname.endsWith('.r2.dev');

export const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/');

/** Object key in the assets bucket for a key stored in content. */
export const assetObjectKey = (key: string) => (ASSETS_FOLDER ? `${ASSETS_FOLDER}/${key}` : key);

/** A stored asset key has no scheme and is not root-relative; anything else is used verbatim. */
export const isAssetKey = (src: string) => !/^([a-z][a-z\d+.-]*:|\/)/i.test(src);

export const assetUrl = (key: string) => `${ASSETS_ORIGIN}/${encodeKey(assetObjectKey(key))}`;

/** Resolve whatever content holds in an image field to something a browser can load. */
export const resolveAssetSrc = (src: string) => (isAssetKey(src) ? assetUrl(src) : src);

/** Only our own assets go through the resizer; others render as-is (next/image `unoptimized`). */
export const isTransformableSrc = (src: string) =>
  CAN_TRANSFORM_ASSETS && src.startsWith(`${ASSETS_ORIGIN}/`);

export const transformAssetUrl = (src: string, width: number, quality: number) => {
  if (!isTransformableSrc(src)) {
    return src;
  }
  // onerror=redirect: past the free transformation quota the original is served instead of an error.
  const options = `width=${width},quality=${quality},format=auto,onerror=redirect`;
  return `${ASSETS_ORIGIN}/cdn-cgi/image/${options}${src.slice(ASSETS_ORIGIN.length)}`;
};
