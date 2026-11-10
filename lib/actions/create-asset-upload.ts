'use server';

import { MAX_IMAGE_SIZE } from '@/lib/constants/image';
import { isContentImageScope } from '@/lib/content-editing-validation';
import { requireEditSession } from '@/lib/server/edit-session';
import { createAssetUploadUrl } from '@/lib/storage/r2';
import { type ActionResult, createActionError, validationError } from '@/lib/types/action-result';
import {
  buildAssetKey,
  type EditorImageScope,
  generateEditorImageId,
} from '@/lib/utils/editor-image';

// Masters are capped at 4096px on the client; leave headroom without accepting absurd values.
const MAX_IMAGE_DIMENSION = 8192;
// An 8px WebP preview is ~100–300 bytes; R2 caps all custom metadata at 2KB.
const MAX_BLUR_LENGTH = 1024;
const BLUR_PREFIX = 'data:image/webp;base64,';

interface ICreateAssetUploadInput {
  scope: EditorImageScope;
  entityId: string;
  imageId?: string;
  /** Exact byte size of the WebP the browser is about to upload. */
  size: number;
  width: number;
  height: number;
  blur: string;
}

export interface IAssetUpload {
  /** Asset key to store in content, e.g. `memos/memo_x_y.webp`. */
  key: string;
  /** Short-lived URL to PUT the file to. */
  uploadUrl: string;
  /** Headers the PUT must send exactly as given; all of them are signed. */
  headers: Record<string, string>;
}

const isDimension = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_IMAGE_DIMENSION;

/**
 * Hands the browser a signed URL to upload one image straight to the assets bucket, so large
 * photos never pass through a serverless request (Vercel caps bodies at 4.5MB). The server picks
 * the key and signs the type, size and metadata, so the upload cannot land anywhere else or
 * carry anything else.
 */
export async function createAssetUploadAction(
  input: ICreateAssetUploadInput,
): Promise<ActionResult<IAssetUpload>> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  if (!isContentImageScope(input.scope)) {
    return validationError('Invalid image scope');
  }
  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > MAX_IMAGE_SIZE) {
    return validationError(`Image size must be at most ${MAX_IMAGE_SIZE / 1024 / 1024}MB`);
  }
  if (!isDimension(input.width) || !isDimension(input.height)) {
    return validationError('Invalid image dimensions');
  }
  if (
    typeof input.blur !== 'string' ||
    !input.blur.startsWith(BLUR_PREFIX) ||
    input.blur.length > MAX_BLUR_LENGTH ||
    !/^[A-Za-z0-9+/=]+$/.test(input.blur.slice(BLUR_PREFIX.length))
  ) {
    return validationError('Invalid image preview');
  }

  try {
    const key = buildAssetKey({
      entityId: typeof input.entityId === 'string' ? input.entityId : '',
      imageId:
        typeof input.imageId === 'string' && input.imageId
          ? input.imageId
          : generateEditorImageId(),
      scope: input.scope,
    });
    const { url, headers } = await createAssetUploadUrl(key, {
      size: input.size,
      width: input.width,
      height: input.height,
      blur: input.blur,
    });
    return { success: true, data: { key, uploadUrl: url, headers } };
  } catch (error) {
    console.error('Failed to create asset upload:', error);
    return createActionError(error, 'Failed to prepare upload');
  }
}
