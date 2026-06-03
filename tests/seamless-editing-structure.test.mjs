import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const files = {
  page: read('app/_components/page-mdx-editor-surface.tsx'),
  post: read('app/posts/_components/post-editor-surface.tsx'),
  memo: read('app/memos/_components/memo-editor-surface.tsx'),
  panel: read('app/records/_components/records-side-panel.tsx'),
  editor: read('components/editing/tiptap-editor.tsx'),
  actionBar: read('components/editing/action-bar.tsx'),
  connect: read('components/editing/github-token-drawer.tsx'),
  postTitle: read('app/_components/post-title.tsx'),
  globals: read('app/globals.css'),
};

// Every prose surface drives a single token-gated ActionBar — no Lexical.
for (const [name, source] of Object.entries({
  page: files.page,
  post: files.post,
  memo: files.memo,
})) {
  assert.ok(source.includes('TiptapEditor'), `${name} should use the Tiptap editor`);
  assert.ok(
    source.includes('useDockedActionBar'),
    `${name} should publish a docked ActionBar session`,
  );
  assert.ok(source.includes('hasToken'), `${name} should pass token state to the bar`);
  assert.ok(!source.includes('markdown-lexical-editor'), `${name} should not reference Lexical`);
}

// Editor: markdown round-trip + ActionBar-controlled view mode (preview = read-only).
assert.ok(
  files.editor.includes('@tiptap/markdown') &&
    files.editor.includes('getMarkdown') &&
    files.editor.includes("contentType: 'markdown'"),
  'editor should round-trip markdown via the official extension',
);
assert.ok(files.editor.includes('immediatelyRender: false'), 'editor must disable SSR rendering');
assert.ok(
  files.editor.includes('prose dark:prose-invert'),
  'editor body should reuse read-mode prose typography',
);
assert.ok(
  files.editor.includes('SlashCommand') && files.editor.includes('BubbleMenu'),
  'editor should keep slash menu + selection bubble',
);
assert.ok(
  files.editor.includes("editable: mode === 'wysiwyg'") && !files.editor.includes('modeToggleSlot'),
  'editor view mode should be controlled by the ActionBar, not an in-editor toggle',
);

// ActionBar: token gate, in-bar mode toggle, unified bottom bar across viewports, ⌘↵ save.
assert.ok(
  files.actionBar.includes('hasToken') && files.actionBar.includes('Connect to save'),
  'action bar should collapse to Connect when no token',
);
assert.ok(
  files.actionBar.includes('onModeChange') &&
    files.actionBar.includes('Preview') &&
    files.actionBar.includes('SquarePenIcon'),
  'action bar should host the preview/edit view-mode toggle as icon buttons',
);
assert.ok(
  files.actionBar.includes('Connect to save') && files.actionBar.includes('hasToken'),
  'action bar collapses to a context-free Connect action without a token',
);
assert.ok(
  files.actionBar.includes("event.key === 'Enter'") && !files.actionBar.includes('fz-mtopbar'),
  'action bar is one shared bottom bar across viewports (no separate mobile top bar) and supports ⌘↵',
);

// Whole-doc reuses the read-mode title shell; post keeps inline date/tags when editing.
assert.ok(
  files.page.includes('<PostTitle') &&
    files.page.includes('titleNode=') &&
    files.page.includes('minHeightClassName="min-h-0"'),
  'page edit reuses the read-mode title/body rhythm',
);
assert.ok(
  files.page.includes('mdxTodoListsToMarkdown') && files.page.includes('markdownTodoListsToMdx'),
  'page editor round-trips TodoList MDX into editable checklists',
);
assert.ok(
  files.postTitle.includes("titleNode ? 'hidden md:flex' : 'flex'"),
  'shared title shell keeps affordances responsive',
);
assert.ok(
  files.post.includes('name="post-created-time"') && files.post.includes('name="post-tags-inline"'),
  'post editing keeps date and tags editable inline',
);

// Records side panel uses vaul; memos add images via an inline box.
assert.ok(
  files.panel.includes("from 'vaul'") &&
    files.panel.includes('direction="right"') &&
    files.panel.includes('fz-textarea'),
  'records should edit through a vaul right drawer with a structured form',
);
assert.ok(
  files.memo.includes('fz-cover-empty') && files.memo.includes('Add image'),
  'memos should attach images through an inline add box',
);

// Connect sheet + token system + edit-mode components in globals.
assert.ok(
  files.connect.includes('fz-sheet') && files.connect.includes('Connect to save'),
  'token entry is an on-demand connect sheet',
);
for (const token of [
  '.fz-actionbar',
  '.fz-handle',
  '.fz-slash',
  '.fz-bubble',
  '.fz-sidepanel',
  '.fz-sheet',
  '.fz-format-pill',
  "ul[data-type='taskList']",
]) {
  assert.ok(files.globals.includes(token), `globals.css should define ${token}`);
}

console.log('seamless-editing-structure: OK');
