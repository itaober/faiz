import assert from 'node:assert/strict';
import test from 'node:test';

import contentImageLoader from '../lib/image-loader.ts';

test('maps content images onto build-time width variants', () => {
  assert.equal(
    contentImageLoader({ src: '/api/image/assets/avatar.webp', width: 640 }),
    '/images/w640/assets/avatar.webp',
  );
  assert.equal(
    contentImageLoader({ src: '/api/image/assets/posts/中电一期的树.webp', width: 1080 }),
    '/images/w1080/assets/posts/中电一期的树.webp',
  );
});

test('passes non-content sources through untouched', () => {
  assert.equal(contentImageLoader({ src: '/icon-192x192.png', width: 640 }), '/icon-192x192.png');
  assert.equal(
    contentImageLoader({ src: 'https://cdn.example.com/x.png', width: 640 }),
    'https://cdn.example.com/x.png',
  );
});

test('serves originals in dev, where no variants exist', () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  try {
    assert.equal(
      contentImageLoader({ src: '/api/image/assets/avatar.webp', width: 640 }),
      '/api/image/assets/avatar.webp',
    );
  } finally {
    process.env.NODE_ENV = previous;
  }
});
