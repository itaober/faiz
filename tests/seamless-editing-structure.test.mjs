import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const files = {
  page: read('app/_components/page-mdx-editor-surface.tsx'),
  post: read('app/posts/_components/post-editor-surface.tsx'),
  postActions: read('app/posts/_components/posts-title-actions.tsx'),
  memo: read('app/memos/_components/memo-editor-surface.tsx'),
  memoInline: read('app/memos/_components/memo-card-inline.tsx'),
  record: read('app/records/_components/record-editor-surface.tsx'),
  recordItem: read('app/records/_components/record-item.tsx'),
};

for (const [name, source] of Object.entries({
  page: files.page,
  post: files.post,
  memo: files.memo,
  record: files.record,
})) {
  assert.equal(
    source.includes('chrome="seamless"'),
    true,
    `${name} editor should use the seamless editor chrome`,
  );
  assert.equal(
    /Editing (about|post|memo|record|\$\{page\})|New (post|memo|record)/.test(source),
    false,
    `${name} editor should not render admin-style editing labels`,
  );
}

assert.equal(
  files.page.includes('mdxTodoListsToMarkdown') && files.page.includes('markdownTodoListsToMdx'),
  true,
  'page editor should transform TodoList MDX into editable checklists and back',
);

assert.equal(
  files.postActions.includes("router.push('/posts/new')"),
  true,
  'post add action should navigate to the blank post page',
);

assert.equal(
  files.memoInline.includes('<MemoEditorSurface') && files.memoInline.includes('children'),
  true,
  'memo edit should keep the timeline/card wrapper and replace only the memo body',
);

assert.equal(
  files.recordItem.includes('RecordEditorSurface') && files.recordItem.includes('motion.div'),
  true,
  'record edit should keep the original record card shell editable in place',
);
