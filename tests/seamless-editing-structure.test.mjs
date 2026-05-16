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
  recordsComposerContext: read('app/records/_components/records-inline-composer-context.tsx'),
  recordsComposerState: read('app/records/_components/records-inline-composer-state.ts'),
  recordsList: read('app/records/_components/records-list-client.tsx'),
  markdownEditor: read('components/editing/markdown-lexical-editor.tsx'),
  globals: read('app/globals.css'),
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
    source.includes('toolbarPortal'),
    true,
    `${name} editor should portal the formatting trigger into the page action row`,
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
  files.markdownEditor.includes('editor-checklist-item') &&
    files.globals.includes('.editor-checklist-item::before') &&
    files.globals.includes('padding-inline-start: 1.75rem'),
  true,
  'editable TodoList items should keep visible checkbox affordances in WYSIWYG mode',
);

assert.equal(
  /listitemChecked:\s*'[^']*line-through/.test(files.markdownEditor),
  false,
  'checked TodoList items should stay visually aligned with the read-only page instead of becoming struck-through admin UI',
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
  files.memoInline.includes('editorActionsPortal') &&
    files.memoInline.includes('actionsPortal={editorActionsPortal}') &&
    files.memo.includes('createPortal(actions, actionsPortal)'),
  true,
  'memo edit controls should reuse the existing memo header action slot instead of inserting an admin row into the body',
);

assert.equal(
  !files.memoInline.includes('isEditing ? null : <MemoCardActions'),
  true,
  'memo edit should replace the original edit/delete actions while the inline editor is active',
);

assert.equal(
  files.recordItem.includes('RecordEditorSurface') && files.recordItem.includes('motion.div'),
  true,
  'record edit should keep the original record card shell editable in place',
);

assert.equal(
  files.recordsComposerState.includes('editingRecordKey') &&
    files.recordsComposerContext.includes('setEditingRecordKeyState(null)') &&
    files.recordsComposerContext.includes('setComposerOpen(false)') &&
    files.recordItem.includes('editingRecordKey === recordKey'),
  true,
  'record add and edit surfaces should be mutually exclusive',
);

assert.equal(
  files.recordsList.includes('{isComposerOpen &&') &&
    files.recordsList.lastIndexOf('RecordEditorSurface') >
      files.recordsList.indexOf('grid grid-cols-2 gap-4'),
  true,
  'record add composer should be inserted as the first grid item',
);

assert.equal(
  files.record.includes('Review') &&
    files.record.includes('absolute') &&
    files.record.includes('isReviewOpen'),
  true,
  'record review editing should use a floating layer that does not resize the grid item',
);

assert.equal(
  files.record.includes('Record details') && !files.record.includes('useState(!record)'),
  true,
  'record maintenance fields should live behind an explicit details popover, not open by default',
);

assert.equal(
  files.record.includes('initialType') &&
    files.recordsList.includes("activeTab === 'all' ? undefined : activeTab") &&
    files.recordsList.includes("squareCover={activeTab === 'music'}") &&
    files.recordItem.includes('squareCover={isMusicTab}') &&
    files.record.includes('const hasCover = !!(coverPreviewSrc.trim() || pendingCoverFile)'),
  true,
  'record composer and editor should preserve the active tab/type and cover aspect, and uploaded covers should enable save before they have final URLs',
);

assert.equal(
  files.markdownEditor.includes('toolbarPortal') &&
    files.markdownEditor.includes('createPortal') &&
    files.markdownEditor.includes('ToolbarTriggerButton') &&
    files.markdownEditor.includes('Formatting tools') &&
    files.markdownEditor.includes('toolbarPopoverRef') &&
    files.markdownEditor.includes('toolbarPlacement') &&
    files.markdownEditor.includes('bottom: 76') &&
    files.markdownEditor.includes('dockedToolbarTriggerRef'),
  true,
  'seamless toolbar should render as an on-demand formatting popover without pushing layout or colliding with mobile corner controls',
);

assert.equal(
  files.record.includes('toolbarPlacement="below"'),
  true,
  'record review editors should keep the formatting popover inside the floating review surface',
);
