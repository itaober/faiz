import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import ts from 'typescript';

const loadTsModule = path => {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const loadedModule = { exports: {} };
  vm.runInNewContext(output, { exports: loadedModule.exports, module: loadedModule });
  return loadedModule.exports;
};

const validation = loadTsModule('lib/content-editing-validation.ts');
const editorImage = loadTsModule('lib/utils/editor-image.ts');
const editorPreload = loadTsModule('components/editing/preload-editor.ts');

assert.equal(validation.isEditablePage('about'), true);
assert.equal(validation.isEditablePage('lines'), true);
assert.equal(validation.isEditablePage('posts'), false);
assert.equal(validation.isEditablePage(undefined), false);

assert.equal(validation.isRecordType('music'), true);
assert.equal(validation.isRecordType('podcast'), false);
assert.equal(validation.isRecordType({}), false);

assert.equal(
  JSON.stringify(
    validation.normalizeImagePathList(
      [
        'assets/memos/memo_20260228153957_a1b2c3.webp',
        ' assets/memos/memo_20260228153957_a1b2c3.webp ',
        'assets/posts/post-cover.webp',
        'data/posts.json',
        '../data/posts.json',
        '/assets/memos/leading-slash.webp',
        123,
      ],
      'memos',
    ),
  ),
  JSON.stringify({
    invalid: ['assets/posts/post-cover.webp', 'data/posts.json', '../data/posts.json', 123],
    paths: ['assets/memos/memo_20260228153957_a1b2c3.webp', 'assets/memos/leading-slash.webp'],
  }),
);

assert.equal(
  JSON.stringify(validation.normalizeImagePathList('assets/memos/not-an-array.webp', 'memos')),
  JSON.stringify({
    invalid: ['assets/memos/not-an-array.webp'],
    paths: [],
  }),
);

assert.equal(validation.isSafeContentImagePath('assets/records/movie_cover.jpg', 'records'), true);
assert.equal(validation.isSafeContentImagePath('assets/records/movie_cover.jpeg', 'records'), true);
assert.equal(validation.isSafeContentImagePath('assets/records/movie_cover.png', 'records'), true);
assert.equal(validation.isSafeContentImagePath('assets/records/movie_cover.webp', 'records'), true);
assert.equal(
  validation.isSafeContentImagePath('assets/records/nested/cover.webp', 'records'),
  false,
);
assert.equal(validation.isSafeContentImagePath('assets/pages/about_cover.webp', 'records'), false);

assert.equal(
  editorImage.buildEditorImageStoragePath({
    entityId: '无法停止我的音乐',
    imageId: 'cover',
    scope: 'records',
  }),
  'assets/records/无法停止我的音乐_cover.webp',
);

assert.equal(
  editorImage.buildEditorImageStoragePath({
    entityId: '无法停止我的音乐',
    extension: 'jpg',
    imageId: 'cover',
    scope: 'records',
  }),
  'assets/records/无法停止我的音乐_cover.jpg',
);

let loadCount = 0;
let resolveEditor;
const deferredEditor = new Promise(resolve => {
  resolveEditor = resolve;
});
const preloader = editorPreload.createEditorPreloader(() => {
  loadCount += 1;
  return deferredEditor;
});

const firstPreload = preloader.preload();
const secondPreload = preloader.preload();
assert.equal(firstPreload, secondPreload);
assert.equal(loadCount, 1);

let opened = false;
const openAfterPreload = preloader.openAfterPreload(() => {
  opened = true;
});

await Promise.resolve();
assert.equal(opened, false);

resolveEditor();
await openAfterPreload;
assert.equal(opened, true);
