import assert from 'node:assert/strict';
import test from 'node:test';

import { getLinkCardTarget } from '../lib/link-card.ts';
import {
  getArtistTarget,
  parseArtistAvatar,
  parseNeteaseMetadata,
} from '../lib/server/link-card.ts';

const apple = 'https://music.apple.com/cn/artist/jack-johnson/909253';
const ld = image =>
  `<script type="application/ld+json">${JSON.stringify({ '@type': 'MusicGroup', name: 'Jack Johnson', image })}</script>`;

test('artist requests accept only numeric NetEase IDs and HTTPS Apple artist pages', () => {
  assert.deepEqual(getArtistTarget('netease', 6452), {
    id: '6452',
    url: 'https://music.163.com/api/artist/6452',
  });
  assert.deepEqual(getArtistTarget('apple-music', `${apple}?l=en`), { id: '909253', url: apple });
  for (const value of [null, '6452', 0, -1, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.equal(getArtistTarget('netease', value), null);
  for (const value of [
    'https://127.0.0.1/cn/artist/909253',
    'https://music.apple.com.evil.example/cn/artist/909253',
    'https://music.apple.com@evil.example/cn/artist/909253',
    'https://user:secret@music.apple.com/cn/artist/909253',
    'https://music.apple.com:444/cn/artist/909253',
    'http://music.apple.com/cn/artist/909253',
    'https://music.apple.com/cn/song/909253',
    `https://music.apple.com/cn/artist/${'x'.repeat(2048)}/909253`,
    null,
  ])
    assert.equal(getArtistTarget('apple-music', value), null, String(value));
});

test('artist portraits require matching identity and provider media', () => {
  const portrait = 'https://p1.music.126.net/artist.jpg';
  const body = JSON.stringify({
    code: 200,
    artist: { id: 6452, img1v1Id: 1, img1v1Url: portrait },
  });
  assert.equal(parseArtistAvatar(body, 'netease', '6452'), `${portrait}?param=96y96`);
  assert.equal(parseArtistAvatar(body, 'netease', '1'), undefined);
  assert.equal(
    parseArtistAvatar(
      JSON.stringify({
        code: 200,
        artist: { id: 6452, img1v1Id: 0, picId: 0, img1v1Url: portrait },
      }),
      'netease',
      '6452',
    ),
    undefined,
  );
  assert.equal(
    parseArtistAvatar(
      ld({ url: 'https://is1-ssl.mzstatic.com/486x486bb.png' }),
      'apple-music',
      '909253',
    ),
    'https://is1-ssl.mzstatic.com/96x96bb.jpg',
  );
  for (const value of [
    'https://127.0.0.1/photo.jpg',
    'https://evil.example/photo.jpg',
    'javascript:alert(1)',
    'https://u:p@is1-ssl.mzstatic.com/a',
    'https://is1-ssl.mzstatic.com:444/a',
  ])
    assert.equal(parseArtistAvatar(ld(value), 'apple-music', '909253'), undefined);
});

test('song artwork and default placeholder portraits remain separate', () => {
  const target = getLinkCardTarget('https://music.163.com/song?id=186016');
  const data = parseNeteaseMetadata(
    {
      code: 200,
      songs: [
        {
          name: '晴天',
          album: {
            picUrl: 'https://p1.music.126.net/album.jpg',
            publishTime: Date.UTC(2003, 6, 31),
          },
          artists: [
            {
              name: '周杰伦',
              id: 6452,
              img1v1Id: 0,
              picId: 0,
              img1v1Url: 'https://p1.music.126.net/placeholder.jpg',
            },
          ],
        },
      ],
    },
    target,
  );
  assert.equal(data.title, '晴天');
  assert.equal(data.imageUrl, 'https://p1.music.126.net/album.jpg');
  assert.equal(data.avatarUrl, undefined);
  assert.equal(data.publishedAt, '2003-07-31T00:00:00.000Z');
  assert.throws(() => parseNeteaseMetadata({ code: -462 }, target), /unavailable/);
});

test('albums use artist portraits and playlists use creator avatars', () => {
  const album = parseNeteaseMetadata(
    {
      code: 200,
      album: {
        name: '叶惠美',
        publishTime: 8.64e15 + 1,
        artist: { name: '周杰伦', img1v1Id: 1, img1v1Url: 'https://p2.music.126.net/jay.jpg' },
      },
    },
    getLinkCardTarget('https://music.163.com/album?id=18905'),
  );
  assert.equal(album.avatarUrl, 'https://p2.music.126.net/jay.jpg?param=96y96');
  assert.equal(album.publishedAt, undefined);
  const playlist = parseNeteaseMetadata(
    {
      code: 200,
      result: {
        name: '热歌榜',
        creator: { nickname: '网易云音乐', avatarUrl: 'https://p1.music.126.net/creator.jpg' },
      },
    },
    getLinkCardTarget('https://music.163.com/playlist?id=3778678'),
  );
  assert.equal(playlist.subtitle, '网易云音乐');
  assert.equal(playlist.avatarUrl, 'https://p1.music.126.net/creator.jpg?param=96y96');
});
