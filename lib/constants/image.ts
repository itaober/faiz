// Shared image constants (client + server)

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

// Stored (already-compressed WebP) size, checked on the server.
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// Picked file before compression. Phone photos and screenshots can exceed the stored
// limit but re-encode well under it, so this only guards browser decode memory.
export const MAX_SOURCE_IMAGE_SIZE = 50 * 1024 * 1024;

export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType as (typeof SUPPORTED_IMAGE_TYPES)[number]);
}
