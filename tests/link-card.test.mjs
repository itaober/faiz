import assert from 'node:assert/strict';
import test from 'node:test';

import { formatLinkCard, getLinkCardTarget, parseLinkCardMarkup } from '../lib/link-card.ts';
import { parseLinkCardMetadata } from '../lib/server/link-card.ts';

test('recognizes all eight supported resources and infers semantic type', () => {
  for (const [href, provider, resource, type] of [
    ['https://music.163.com/#/song?id=186016&userid=1', 'netease', 'track', 'music'],
    ['http://music.163.com/album?id=18905', 'netease', 'album', 'music'],
    ['https://y.music.163.com/m/playlist?id=3778678', 'netease', 'playlist', 'music'],
    [
      'https://music.apple.com/cn/album/example/1440857781?i=1440857786&l=en',
      'apple-music',
      'track',
      'music',
    ],
    ['https://music.apple.com/cn/album/1440857781', 'apple-music', 'album', 'music'],
    [
      'https://music.apple.com/cn/playlist/c-pop/pl.974aaf3abeca4e86a954719e83bb1fb1',
      'apple-music',
      'playlist',
      'music',
    ],
    [
      'https://www.xiaoyuzhoufm.com/episode/69b4d2f9f8b8079bfa3ae7f2?s=1',
      'xiaoyuzhou',
      'episode',
      'podcast',
    ],
    [
      'https://www.xiaoyuzhoufm.com/podcast/648b0b641c48983391a63f98',
      'xiaoyuzhou',
      'show',
      'podcast',
    ],
  ]) {
    const target = getLinkCardTarget(href);
    assert.ok(target, href);
    assert.deepEqual([target.provider, target.resource, target.type], [provider, resource, type]);
    assert.equal(new URL(target.url).protocol, 'https:');
    assert.equal(new URL(target.url).hash, '');
  }
  assert.equal(
    getLinkCardTarget('https://music.apple.com/cn/album/x/1440857781?i=1440857786').id,
    '1440857786',
  );
  assert.equal(getLinkCardTarget('https://163cn.tv/abc123').provider, 'netease');
});

test('rejects unsupported, malformed and deceptive platform addresses', () => {
  for (const href of [
    'javascript:alert(1)',
    'file:///etc/passwd',
    'http://127.0.0.1/song?id=1',
    'https://music.163.com.evil.example/song?id=1',
    'https://music.163.com@evil.example/song?id=1',
    'https://user:password@music.163.com/song?id=1',
    'https://music.163.com:444/song?id=1',
    'https://music.163.com/song?id=1%22onload',
    'https://music.163.com/discover',
    'https://music.apple.com/cn',
    'https://music.apple.com/cn/artist/jack/909253',
    'https://www.xiaoyuzhoufm.com/episode/invalid',
    'https://example.com/song?id=1',
  ])
    assert.equal(getLinkCardTarget(href), null, href);
});

test('MDX LinkCard attributes survive serialization without double decoding', () => {
  const card = { type: 'music', href: 'https://music.apple.com/cn/album/x/123?i=456&l=zh' };
  assert.deepEqual(parseLinkCardMarkup(formatLinkCard(card)), card);
  const escaped = { href: 'https://example.com/?q="<hello>&amp;' };
  assert.deepEqual(parseLinkCardMarkup(formatLinkCard(escaped)), escaped);
  assert.equal(parseLinkCardMarkup('<LinkCard type="video" href="https://example.com" />'), null);
  assert.equal(parseLinkCardMarkup('<LinkCard />'), null);
});

const appleTarget = getLinkCardTarget('https://music.apple.com/cn/song/better-together/1440857786');
test('extracts Apple MusicComposition recording, artist, artwork and duration', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({
    '@type': 'MusicComposition',
    name: 'Better Together',
    timeRequired: 'PT3M27S',
    datePublished: '2005-03-01',
    audio: {
      '@type': 'MusicRecording',
      name: 'Better Together',
      duration: 'PT3M27S',
      byArtist: [
        { name: 'Jack Johnson', image: { url: 'https://is1-ssl.mzstatic.com/artist.jpg' } },
      ],
      image: 'https://is1-ssl.mzstatic.com/image/thumb/cover/1200x630bb.jpg',
    },
  })}</script>`;
  const data = parseLinkCardMetadata(html, appleTarget);
  assert.equal(data.title, 'Better Together');
  assert.equal(data.subtitle, 'Jack Johnson');
  assert.equal(data.avatarUrl, 'https://is1-ssl.mzstatic.com/artist.jpg');
  assert.equal(data.duration, 207);
  assert.equal(data.publishedAt, '2005-03-01T00:00:00.000Z');
  assert.equal(data.imageUrl, 'https://is1-ssl.mzstatic.com/image/thumb/cover/320x320bb.jpg');
});

test('extracts Apple playlists without expecting an album-shaped schema', () => {
  const target = getLinkCardTarget(
    'https://music.apple.com/cn/playlist/c-pop/pl.974aaf3abeca4e86a954719e83bb1fb1',
  );
  const data = parseLinkCardMetadata(
    `<meta property="og:image" content="https://is1-ssl.mzstatic.com/cover/600x600bb.jpg"><script type="application/ld+json">${JSON.stringify({ '@type': 'MusicPlaylist', name: 'C-Pop 潮', numTracks: 47, author: { name: 'Apple Music C-Pop' } })}</script>`,
    target,
  );
  assert.equal(data.title, 'C-Pop 潮');
  assert.equal(data.subtitle, 'Apple Music C-Pop');
  assert.equal(data.itemCount, 47);
});

test('extracts Xiaoyuzhou episodes and keeps only platform-hosted artwork', () => {
  const target = getLinkCardTarget('https://www.xiaoyuzhoufm.com/episode/69b4d2f9f8b8079bfa3ae7f2');
  const episode = {
    title: '对谈',
    podcast: { title: '42章经', image: { picUrl: 'https://image.xyzcdn.net/show.jpg' } },
    description: '<p>主持人 &amp; 嘉宾</p>\n 一起聊天。',
    pubDate: '2026-10-18T16:00:00Z',
    duration: 3430,
    image: { picUrl: 'https://image.xyzcdn.net/cover.jpg' },
  };
  const html = item =>
    `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { episode: item } } })}</script>`;
  const data = parseLinkCardMetadata(html(episode), target);
  assert.equal(data.subtitle, '42章经');
  assert.equal(data.avatarUrl, 'https://image.xyzcdn.net/show.jpg');
  assert.equal(data.imageUrl, 'https://image.xyzcdn.net/cover.jpg');
  assert.equal(data.description, '主持人 & 嘉宾 一起聊天。');
  assert.equal(data.publishedAt, '2026-10-18T16:00:00.000Z');
  assert.equal(data.duration, 3430);
  for (const pubDate of ['invalid', '2026', 2026, 8.64e15 + 1])
    assert.equal(
      parseLinkCardMetadata(html({ ...episode, pubDate }), target).publishedAt,
      undefined,
    );
  for (const picUrl of [
    'https://127.0.0.1/private',
    'https://image.xyzcdn.net.evil.example/a',
    'http://u:p@image.xyzcdn.net/a',
    'https://image.xyzcdn.net:444/a',
    'javascript:alert(1)',
  ]) {
    assert.equal(
      parseLinkCardMetadata(html({ ...episode, podcast: {}, image: { picUrl } }), target).imageUrl,
      undefined,
      picUrl,
    );
  }
});

test('extracts Xiaoyuzhou show metadata', () => {
  const target = getLinkCardTarget('https://www.xiaoyuzhoufm.com/podcast/648b0b641c48983391a63f98');
  const data = parseLinkCardMetadata(
    `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { podcast: { title: '42章经', author: 'KaiQu', episodeCount: 73 } } } })}</script>`,
    target,
  );
  assert.equal(data.title, '42章经');
  assert.equal(data.subtitle, 'KaiQu');
  assert.equal(data.itemCount, 73);
});

test('malformed or hostile upstream metadata keeps only safe artwork', () => {
  const target = getLinkCardTarget('https://www.xiaoyuzhoufm.com/episode/69b4d2f9f8b8079bfa3ae7f2');
  const data = parseLinkCardMetadata(
    '<meta property="og:title" content="A &amp; B"><meta property="og:image" content="http://localhost/private"><script id="__NEXT_DATA__">{invalid</script>',
    target,
  );
  assert.equal(data.title, 'A & B');
  assert.equal(data.imageUrl, undefined);
});
