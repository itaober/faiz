import { createHmac, timingSafeEqual } from 'node:crypto';

const DEVELOPMENT_SECRET = 'faiz-development-link-preview-secret';

const getSigningSecret = () =>
  process.env.LINK_PREVIEW_SIGNING_SECRET ||
  (process.env.NODE_ENV === 'production' ? undefined : DEVELOPMENT_SECRET);

export const signLinkIconUrl = (url: string) => {
  const secret = getSigningSecret();
  if (!secret) {
    return undefined;
  }
  return createHmac('sha256', secret).update(url).digest('base64url');
};

export const verifyLinkIconSignature = (url: string, signature: string) => {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) {
    return false;
  }

  const expected = signLinkIconUrl(url);
  if (!expected) {
    return false;
  }

  const actualBuffer = Buffer.from(signature, 'ascii');
  const expectedBuffer = Buffer.from(expected, 'ascii');
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
};
