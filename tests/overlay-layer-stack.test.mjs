import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('Overlay loads the same Radix layer modules as vaul', () => {
  // The layer and focus stacks live in module scope: a second copy is a second stack, and the
  // Overlay would stop working on top of a drawer. Bump the pins in package.json to match vaul.
  const dialog = createRequire(require.resolve('vaul')).resolve('@radix-ui/react-dialog');
  for (const name of ['@radix-ui/react-dismissable-layer', '@radix-ui/react-focus-scope']) {
    assert.equal(require.resolve(name), createRequire(dialog).resolve(name), name);
  }
});
