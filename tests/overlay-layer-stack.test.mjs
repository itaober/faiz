import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('Overlay loads the same layer, focus and scroll-lock modules as vaul', () => {
  // These stacks live in module scope: a second copy is a second stack, and the Overlay would
  // stop working on top of a drawer. Bump the pins in package.json to match vaul's dialog.
  const dialog = createRequire(require.resolve('vaul')).resolve('@radix-ui/react-dialog');
  const shared = [
    '@radix-ui/react-dismissable-layer',
    '@radix-ui/react-focus-scope',
    'react-remove-scroll',
  ];
  for (const name of shared) {
    assert.equal(require.resolve(name), createRequire(dialog).resolve(name), name);
  }
});
