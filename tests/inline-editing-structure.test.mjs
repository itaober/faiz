import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = path => existsSync(new URL(`../${path}`, import.meta.url));

// Whole-doc pages: turning on edit mode mounts the editor directly — no title
// pencil. The editor surface is lazy-loaded so it stays out of the read bundle.
const pageInline = read('app/_components/page-mdx-inline-section.tsx');
assert.ok(
  pageInline.includes("import('@/app/_components/page-mdx-editor-surface')") &&
    pageInline.includes('dynamic(') &&
    pageInline.includes('isEditMode'),
  'page edit should lazy-mount the editor when edit mode is on',
);
const postInline = read('app/posts/_components/post-detail-inline-section.tsx');
assert.ok(
  postInline.includes("import('./post-editor-surface')") &&
    postInline.includes('dynamic(') &&
    postInline.includes('isEditMode'),
  'post detail should lazy-mount the editor when edit mode is on',
);

// Multi-item pages keep the hover handle + lazy editor, content untouched.
const memoInline = read('app/memos/_components/memo-card-inline.tsx');
assert.ok(
  memoInline.includes('memo-editor-loader') &&
    memoInline.includes('openAfterPreload') &&
    memoInline.includes('editingId === memo.id'),
  'memo edit should open one item via the shared editing session',
);
assert.ok(
  memoInline.includes('<MemoEditorSurface') && memoInline.includes('children'),
  'memo edit should keep the card wrapper and swap only the body',
);
const memoTitle = read('app/memos/_components/memos-title.tsx');
assert.ok(memoTitle.includes('openAfterPreload'), 'new memo composer should preload the editor');

// Records edit through a docked side panel opened from a card.
const recordsList = read('app/records/_components/records-list-client.tsx');
assert.ok(
  recordsList.includes('RecordsSidePanel') && !recordsList.includes('record-editor-surface'),
  'records should render the reusable side panel',
);
const recordItem = read('app/records/_components/record-item.tsx');
assert.ok(
  recordItem.includes('editingRecordKey === recordKey') &&
    recordItem.includes('setEditingRecordKey'),
  'record cards should open the panel for the selected record',
);

// The old drawer / Lexical / per-title pencils are fully removed.
for (const removed of [
  'app/posts/_components/post-editor-drawer.tsx',
  'app/records/_components/record-editor-surface.tsx',
  'app/memos/_components/memo-card-actions.tsx',
  'app/_components/page-mdx-actions.tsx',
  'app/posts/_components/post-detail-actions.tsx',
  'components/editing/markdown-lexical-editor.tsx',
]) {
  assert.equal(exists(removed), false, `${removed} should be removed`);
}

console.log('inline-editing-structure: OK');
