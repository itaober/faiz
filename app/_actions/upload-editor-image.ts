'use server';

import { revalidatePath } from 'next/cache';

import { MAX_IMAGE_SIZE } from '@/lib/constants/image';
import { getImageExtensionFromMimeType } from '@/lib/content-editing-validation';
import { uploadImage } from '@/lib/data/images';
import { requireAuth } from '@/lib/server/content-edit-token';
import { type ActionResult, createActionError } from '@/lib/types/action-result';
import {
  buildEditorImageStoragePath,
  type EditorImageScope,
  generateEditorImageId,
} from '@/lib/utils/editor-image';

const ALLOWED_SCOPES = ['memos', 'posts', 'pages', 'records'] as const;

interface IUploadEditorImageInput {
  imageBase64: string;
  mimeType: string;
  scope: EditorImageScope;
  entityId: string;
  token: string;
  imageId?: string;
  revalidate?: string;
}

interface IUploadRemoteEditorImageInput {
  imageUrl: string;
  scope: EditorImageScope;
  entityId: string;
  token: string;
  imageId?: string;
  revalidate?: string;
}

const createUploadValidationError = (error: string): ActionResult<string> => ({
  success: false,
  error,
  code: 'VALIDATION',
  retryable: false,
});

const isAllowedScope = (scope: string): scope is EditorImageScope =>
  ALLOWED_SCOPES.includes(scope as EditorImageScope);

const isPrivateIpv4Host = (hostname: string) => {
  const parts = hostname.split('.').map(part => Number(part));
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first = 0, second = 0] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
};

const isBlockedRemoteImageHost = (hostname: string) => {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();

  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    return true;
  }

  if (isPrivateIpv4Host(host)) {
    return true;
  }

  const isIpv6Host = host.includes(':');
  return (
    isIpv6Host &&
    (host === '::1' ||
      host === '0:0:0:0:0:0:0:1' ||
      host.startsWith('fe80:') ||
      host.startsWith('fc') ||
      host.startsWith('fd'))
  );
};

const normalizeRemoteImageUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    return isBlockedRemoteImageHost(url.hostname) ? null : url;
  } catch {
    return null;
  }
};

export async function uploadEditorImageAction(
  input: IUploadEditorImageInput,
): Promise<ActionResult<string>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!isAllowedScope(input.scope)) {
    return createUploadValidationError('Invalid image scope');
  }

  try {
    const storagePath = buildEditorImageStoragePath({
      entityId: input.entityId,
      imageId: input.imageId || generateEditorImageId(),
      scope: input.scope,
    });

    const result = await uploadImage({
      imageBase64: input.imageBase64,
      mimeType: input.mimeType,
      storagePath,
      token,
    });

    if (input.revalidate) {
      revalidatePath(input.revalidate);
    }

    return { success: true, data: result.path };
  } catch (error) {
    console.error('Failed to upload editor image:', error);
    return createActionError(error, 'Failed to upload image');
  }
}

export async function uploadRemoteEditorImageAction(
  input: IUploadRemoteEditorImageInput,
): Promise<ActionResult<string>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  if (!isAllowedScope(input.scope)) {
    return createUploadValidationError('Invalid image scope');
  }

  const imageUrl = normalizeRemoteImageUrl(input.imageUrl);
  if (!imageUrl) {
    return createUploadValidationError('Invalid image URL');
  }

  try {
    const response = await fetch(imageUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8',
        'User-Agent': 'faiz-blog',
      },
    });

    if (!response.ok) {
      throw new Error(`Remote image failed: ${response.status} ${response.statusText}`);
    }

    const responseContentLength = Number(response.headers.get('content-length') ?? 0);
    if (responseContentLength > MAX_IMAGE_SIZE) {
      return createUploadValidationError('Image size exceeds limit');
    }

    const mimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '';
    const extension = getImageExtensionFromMimeType(mimeType);
    if (!extension) {
      return createUploadValidationError('Remote URL is not a supported image');
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_SIZE) {
      return createUploadValidationError('Image size exceeds limit');
    }

    const storagePath = buildEditorImageStoragePath({
      entityId: input.entityId,
      extension,
      imageId: input.imageId || generateEditorImageId(),
      scope: input.scope,
    });

    const result = await uploadImage({
      imageBase64: buffer.toString('base64'),
      mimeType,
      storagePath,
      token,
    });

    if (input.revalidate) {
      revalidatePath(input.revalidate);
    }

    return { success: true, data: result.path };
  } catch (error) {
    console.error('Failed to upload remote editor image:', error);
    return createActionError(error, 'Failed to upload image');
  }
}
