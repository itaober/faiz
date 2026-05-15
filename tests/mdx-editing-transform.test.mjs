import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import ts from 'typescript';

const source = readFileSync(new URL('../lib/mdx-editing.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

const loadedModule = { exports: {} };
vm.runInNewContext(output, { exports: loadedModule.exports, module: loadedModule });

const { markdownTodoListsToMdx, mdxTodoListsToMarkdown } = loadedModule.exports;

const mdx = `Intro

<TodoList
  readonly={true}
  items={[
    { label: "做一个真诚、快乐的人" },
    { label: "存 100 万" },
    {
      label: (
        <div>
          在博客上持续输出文字 - 见 <Link href="/posts">Posts</Link>
        </div>
      ),
      checked: true,
    },
  ]}
/>

Outro`;

const markdown = mdxTodoListsToMarkdown(mdx);

assert.equal(markdown.includes('<TodoList'), false);
assert.equal(markdown.includes('- [ ] 做一个真诚、快乐的人'), true);
assert.equal(markdown.includes('- [x] 在博客上持续输出文字 - 见 [Posts](/posts)'), true);

const restored = markdownTodoListsToMdx(markdown);

assert.equal(restored.includes('<TodoList'), true);
assert.equal(restored.includes('readonly={true}'), true);
assert.equal(restored.includes('{ label: "做一个真诚、快乐的人" }'), true);
assert.equal(restored.includes('checked: true'), true);
assert.equal(restored.includes('<Link href="/posts">Posts</Link>'), true);
