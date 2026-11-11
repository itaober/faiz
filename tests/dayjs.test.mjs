import assert from 'node:assert/strict';
import test from 'node:test';

import { formatTime } from '../lib/dayjs.ts';

test('content dates are Beijing wall-clock, whatever zone the browser or server runs in', () => {
  // 17:30 UTC on the 10th is already the 11th in Beijing; a UTC date default would say the 10th.
  assert.equal(formatTime('2026-11-10T17:30:00Z'), '2026-11-11 01:30:00');
  assert.equal(formatTime('2026-11-10T17:30:00Z').slice(0, 10), '2026-11-11');
});
