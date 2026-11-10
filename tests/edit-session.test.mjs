import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createEditSession,
  EDIT_SESSION_MAX_AGE_SECONDS,
  isEditKey,
  verifyEditSession,
} from '../lib/edit-session-token.ts';

const KEY = 'k'.repeat(43);
const NOW = 1_800_000_000_000;

test('a session signed with the key verifies until it expires', () => {
  const session = createEditSession(KEY, NOW);
  assert.equal(verifyEditSession(KEY, session, NOW + 1000), true);
  assert.equal(verifyEditSession(KEY, session, NOW + EDIT_SESSION_MAX_AGE_SECONDS * 1000), false);
});

test('rotating the key signs every session out', () => {
  const session = createEditSession(KEY, NOW);
  assert.equal(verifyEditSession('r'.repeat(43), session, NOW), false);
});

test('a forged or tampered session is rejected', () => {
  const [expiresAt, sig] = createEditSession(KEY, NOW).split('.');
  assert.equal(verifyEditSession(KEY, `${Number(expiresAt) + 1}.${sig}`, NOW), false);
  assert.equal(verifyEditSession(KEY, `${expiresAt}.forged`, NOW), false);
  assert.equal(verifyEditSession(KEY, undefined, NOW), false);
  assert.equal(verifyEditSession(KEY, 'garbage', NOW), false);
});

test('only the exact edit key passes', () => {
  assert.equal(isEditKey(KEY, KEY), true);
  assert.equal(isEditKey(KEY, `${KEY} `), false);
  assert.equal(isEditKey(KEY, ''), false);
});
