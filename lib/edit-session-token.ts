import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const EDIT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

// Derived from the edit key, so rotating that key also signs every existing session out.
const signingKey = (editKey: string) =>
  createHmac('sha256', editKey).update('faiz:edit-session:v1').digest();

const signature = (editKey: string, expiresAt: number) =>
  createHmac('sha256', signingKey(editKey)).update(String(expiresAt)).digest('base64url');

const safeEqual = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b);

/** Cookie value: `<expiresAt>.<signature>`; the expiry is covered by the signature. */
export const createEditSession = (editKey: string, now: number) => {
  const expiresAt = now + EDIT_SESSION_MAX_AGE_SECONDS * 1000;
  return `${expiresAt}.${signature(editKey, expiresAt)}`;
};

export const verifyEditSession = (editKey: string, value: string | undefined, now: number) => {
  const [rawExpiresAt, sig] = value?.split('.') ?? [];
  const expiresAt = Number(rawExpiresAt);
  if (!sig || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    return false;
  }
  return safeEqual(Buffer.from(sig), Buffer.from(signature(editKey, expiresAt)));
};

/** Hashing first gives equal-length buffers, so the comparison never leaks the key length. */
export const isEditKey = (editKey: string, candidate: string) =>
  safeEqual(
    createHash('sha256').update(candidate).digest(),
    createHash('sha256').update(editKey).digest(),
  );
