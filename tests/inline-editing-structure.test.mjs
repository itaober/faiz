import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const expectations = [
  {
    file: 'app/posts/_components/posts-title-actions.tsx',
    forbidden: ['post-editor-drawer'],
    required: ['usePostsInlineComposer'],
  },
  {
    file: 'app/posts/_components/posts-list.tsx',
    forbidden: ['post-editor-drawer'],
    required: ['post-editor-surface'],
  },
  {
    file: 'app/posts/_components/post-detail-actions.tsx',
    forbidden: ['post-editor-drawer'],
    required: ['onEdit'],
  },
  {
    file: 'app/posts/_components/post-detail-inline-section.tsx',
    forbidden: ['post-editor-drawer'],
    required: ['post-editor-surface'],
  },
  {
    file: 'app/memos/_components/memos-title.tsx',
    forbidden: ['memo-editor-drawer'],
    required: ['memo-editor-surface'],
  },
  {
    file: 'app/memos/_components/memo-card-actions.tsx',
    forbidden: ['memo-editor-drawer'],
    required: ['onEdit'],
  },
  {
    file: 'app/memos/_components/memo-card-inline.tsx',
    forbidden: ['memo-editor-drawer'],
    required: ['memo-editor-surface'],
  },
  {
    file: 'app/records/_components/records-title-actions.tsx',
    forbidden: ['record-editor-drawer'],
    required: ['useRecordsInlineComposer'],
  },
  {
    file: 'app/records/_components/records-list-client.tsx',
    forbidden: ['record-editor-drawer'],
    required: ['record-editor-surface'],
  },
  {
    file: 'app/records/_components/record-item.tsx',
    forbidden: ['record-editor-drawer'],
    required: ['record-editor-surface'],
  },
  {
    file: 'app/_components/page-mdx-actions.tsx',
    forbidden: ['Drawer.Root'],
    required: ['onEdit'],
  },
  {
    file: 'app/_components/page-mdx-inline-section.tsx',
    forbidden: ['Drawer.Root'],
    required: ['page-mdx-editor-surface'],
  },
];

for (const expectation of expectations) {
  const source = read(expectation.file);

  for (const forbidden of expectation.forbidden) {
    assert.equal(
      source.includes(forbidden),
      false,
      `${expectation.file} should not reference ${forbidden}`,
    );
  }

  for (const required of expectation.required) {
    assert.equal(
      source.includes(required),
      true,
      `${expectation.file} should reference ${required}`,
    );
  }
}

for (const removedDrawer of [
  'app/posts/_components/post-editor-drawer.tsx',
  'app/memos/_components/memo-editor-drawer.tsx',
  'app/records/_components/record-editor-drawer.tsx',
]) {
  assert.equal(existsSync(new URL(`../${removedDrawer}`, import.meta.url)), false);
}
