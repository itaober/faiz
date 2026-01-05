// Shared image constants (client + server)

export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function isSupportedImageType(mimeType: string): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType as (typeof SUPPORTED_IMAGE_TYPES)[number]);
}
