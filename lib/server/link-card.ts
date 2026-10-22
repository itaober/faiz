import {
  getLinkCardFallback,
  getLinkCardTarget,
  type LinkCardData,
  type LinkCardProvider,
  type LinkCardTarget,
  type LinkCardType,
} from '../link-card.ts';

import { cleanText, fetchLinkResource, parseHtmlMetadata } from './link-preview.ts';

const CACHE_TTL = 24 * 60 * 60 * 1000;
const cache = new Map<string, { expires: number; data: LinkCardData }>();
const requests = new Map<string, Promise<LinkCardData>>();
const avatars = new Map<string, { expires: number; request: Promise<string | undefined> }>();
const HOSTS: Record<LinkCardProvider, Set<string>> = {
  netease: new Set([
    'music.163.com',
    'm.music.163.com',
    'y.music.163.com',
    '163cn.tv',
    '163cn.link',
  ]),
  'apple-music': new Set(['music.apple.com']),
  xiaoyuzhou: new Set(['www.xiaoyuzhoufm.com', 'xiaoyuzhoufm.com']),
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown) => (typeof value === 'string' ? cleanText(value, 240) : undefined);
const number = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const names = (value: unknown) =>
  list(value)
    .map(item => text(record(item).name))
    .filter(Boolean)
    .join('、') || undefined;

const mediaUrl = (value: unknown, provider: LinkCardProvider) => {
  if (typeof value !== 'string') return undefined;
  try {
    const url = new URL(value);
    const allowed = {
      netease: /(^|\.)music\.126\.net$/,
      'apple-music': /(^|\.)mzstatic\.com$/,
      xiaoyuzhou: /(^|\.)xyzcdn\.net$/,
    }[provider].test(url.hostname);
    if (
      !allowed ||
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return undefined;
    }
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return undefined;
  }
};

const avatarUrl = (value: unknown, provider: LinkCardProvider) => {
  const safe = mediaUrl(value, provider);
  if (!safe) return undefined;
  if (provider === 'netease') {
    const url = new URL(safe);
    url.searchParams.set('param', '96y96');
    return url.toString();
  }
  return provider === 'apple-music'
    ? safe.replace(/\/\d+x\d+[^/]*\.(?:jpg|png|webp)$/, '/96x96bb.jpg')
    : safe;
};

const isoDate = (value: unknown) => {
  if ((typeof value !== 'string' && typeof value !== 'number') || !value) return undefined;
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined;
};

const isoDuration = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
  return match
    ? number(Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0))
    : undefined;
};

const jsonScripts = (html: string) => {
  const result: Record<string, unknown>[] = [];
  for (const match of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const data: unknown = JSON.parse(match[1]);
      for (const item of Array.isArray(data) ? data : [data]) {
        result.push(record(item), ...list(record(item)['@graph']).map(record));
      }
    } catch {
      // A partial or malformed upstream script must not hide the original link.
    }
  }
  return result;
};

const appleArtist = (root: Record<string, unknown>) => {
  const artist = root.byArtist || record(root.audio).byArtist || root.author;
  return record(list(artist)[0] || artist);
};

export const parseLinkCardMetadata = (html: string, target: LinkCardTarget): LinkCardData => {
  const metadata = parseHtmlMetadata(html);
  const data: LinkCardData = {
    ...target,
    title:
      cleanText(metadata.get('og:title') || metadata.get('twitter:title'), 240) ||
      getLinkCardFallback(target).title,
    imageUrl: mediaUrl(
      metadata.get('og:image:secure_url') || metadata.get('og:image'),
      target.provider,
    ),
  };
  if (target.provider === 'apple-music') {
    const roots = jsonScripts(html);
    const root =
      roots.find(item =>
        ['MusicAlbum', 'MusicRecording', 'MusicComposition', 'MusicPlaylist'].includes(
          String(item['@type']),
        ),
      ) || {};
    const track = list(root.tracks)
      .map(record)
      .find(item => String(item.url).split('/').pop() === target.id);
    const recording = record(root.audio);
    const item =
      target.resource === 'track'
        ? track || (recording['@type'] === 'MusicRecording' ? recording : root)
        : root;
    data.title = text(item.name) || text(root.name) || data.title;
    data.subtitle =
      names(item.byArtist) ||
      text(record(item.byArtist).name) ||
      names(root.byArtist) ||
      text(record(root.byArtist).name) ||
      text(record(root.author).name) ||
      text(root.author);
    data.duration = isoDuration(item.duration) || isoDuration(root.timeRequired);
    data.publishedAt = isoDate(
      text(item.datePublished) || text(root.datePublished) || metadata.get('music:release_date'),
    );
    const artist = appleArtist(item);
    data.avatarUrl = avatarUrl(
      typeof artist.image === 'string' ? artist.image : record(artist.image).url,
      target.provider,
    );
    data.itemCount =
      target.resource !== 'track'
        ? number(root.numTracks) ||
          number(Number(metadata.get('music:song_count'))) ||
          number(list(root.tracks).length)
        : undefined;
    const image = text(item.image) || text(record(item.audio).thumbnailUrl) || data.imageUrl;
    data.imageUrl = mediaUrl(image, target.provider)?.replace(
      /\/\d+x\d+[^/]*\.(?:jpg|png|webp)$/,
      '/320x320bb.jpg',
    );
  } else if (target.provider === 'xiaoyuzhou') {
    const raw = html.match(
      /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    )?.[1];
    let props: Record<string, unknown> = {};
    try {
      props = record(record(record(JSON.parse(raw || '{}')).props).pageProps);
    } catch {
      // Open Graph remains useful when the hydration payload exceeds the read cap.
    }
    const item = record(target.resource === 'episode' ? props.episode : props.podcast);
    const podcast = target.resource === 'episode' ? record(item.podcast) : item;
    const ld = jsonScripts(html)[0] || {};
    data.title = text(item.title) || text(ld.name) || data.title;
    data.subtitle =
      target.resource === 'episode' ? text(podcast.title) : text(item.author) || text(ld.author);
    data.duration = number(item.duration);
    data.description =
      text(item.description) || text(ld.description) || text(metadata.get('og:description'));
    data.publishedAt = isoDate(text(item.pubDate));
    data.avatarUrl = avatarUrl(
      record(podcast.image).thumbnailUrl || record(podcast.image).picUrl,
      target.provider,
    );
    data.itemCount = target.resource === 'show' ? number(item.episodeCount) : undefined;
    data.imageUrl =
      mediaUrl(
        record(item.image).middlePicUrl ||
          record(item.image).picUrl ||
          record(podcast.image).middlePicUrl ||
          record(podcast.image).picUrl,
        target.provider,
      ) || data.imageUrl;
  } else {
    data.subtitle = cleanText(metadata.get('og:music:artist'), 120);
    data.duration = number(Number(metadata.get('music:duration')));
    data.itemCount = number(Number(metadata.get('music:song_count')));
  }
  return data;
};

const readResource = async (url: string, provider: LinkCardProvider, json = false) => {
  const { response, url: resolved } = await fetchLinkResource(url, {
    accept: json ? 'application/json' : 'text/html,application/xhtml+xml;q=0.9',
    maxBytes: 2 * 1024 * 1024,
    contentTypes: new Set(
      json ? ['application/json', 'text/plain'] : ['text/html', 'application/xhtml+xml'],
    ),
    truncate: !json,
    validateUrl: next => {
      if (next.protocol !== 'https:' || !HOSTS[provider].has(next.hostname)) {
        throw new Error('Unsupported link card redirect');
      }
    },
  });
  return { body: response.body?.toString('utf8') || '', url: resolved.toString() };
};

export const parseArtistAvatar = (
  body: string,
  provider: 'netease' | 'apple-music',
  id: string,
) => {
  if (provider === 'netease') {
    const json = record(JSON.parse(body));
    const artist = record(json.artist);
    if (
      json.code !== 200 ||
      String(artist.id) !== id ||
      (artist.img1v1Id === 0 && artist.picId === 0)
    )
      return undefined;
    return avatarUrl(artist.img1v1Url || artist.picUrl, provider);
  }
  const artist = jsonScripts(body).find(item =>
    ['MusicGroup', 'Person'].includes(String(item['@type'])),
  );
  return avatarUrl(
    typeof artist?.image === 'string' ? artist.image : record(artist?.image).url,
    provider,
  );
};

export const getArtistTarget = (
  provider: 'netease' | 'apple-music',
  source: unknown,
): { url: string; id: string } | null => {
  if (provider === 'netease') {
    if (typeof source !== 'number' || !Number.isSafeInteger(source) || source <= 0) return null;
    const id = String(source);
    return { id, url: `https://music.163.com/api/artist/${id}` };
  }
  try {
    if (typeof source !== 'string' || source.length > 2048) return null;
    const parsed = new URL(source);
    const match = parsed.pathname.match(/^\/[a-z]{2}\/artist\/(?:[^/]+\/)?(\d+)\/?$/i);
    if (
      !match ||
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'music.apple.com' ||
      parsed.username ||
      parsed.password ||
      parsed.port
    )
      return null;
    return { id: match[1], url: `${parsed.origin}${parsed.pathname}` };
  } catch {
    return null;
  }
};

const fetchArtistAvatar = (
  provider: 'netease' | 'apple-music',
  source: unknown,
): Promise<string | undefined> => {
  const target = getArtistTarget(provider, source);
  if (!target) return Promise.resolve(undefined);
  const { url, id } = target;
  const cached = avatars.get(url);
  if (cached && cached.expires > Date.now()) return cached.request;
  const request = readResource(url, provider, provider === 'netease')
    .then(result => {
      if (provider === 'apple-music' && getArtistTarget(provider, result.url)?.id !== id)
        return undefined;
      return parseArtistAvatar(result.body, provider, id);
    })
    .catch(() => undefined);
  const entry = { request, expires: Date.now() + CACHE_TTL };
  request.then(avatar => {
    if (!avatar) entry.expires = Date.now() + 60_000;
  });
  avatars.delete(url);
  avatars.set(url, entry);
  while (avatars.size > 100) {
    const oldest = avatars.keys().next().value;
    if (oldest) avatars.delete(oldest);
  }
  return request;
};

export const parseNeteaseMetadata = (value: unknown, target: LinkCardTarget): LinkCardData => {
  const json = record(value);
  if (json.code !== 200) throw new Error('Music metadata unavailable');
  const item = record(
    target.resource === 'track'
      ? list(json.songs)[0]
      : target.resource === 'album'
        ? json.album
        : json.result,
  );
  const title = text(item.name);
  if (!title) throw new Error('Music metadata unavailable');
  const album = record(item.album);
  const artist = record(item.artist || list(item.artists)[0]);
  const portrait = number(artist.img1v1Id) || number(artist.picId);
  return {
    ...target,
    title,
    subtitle:
      names(item.artists) || text(record(item.artist).name) || text(record(item.creator).nickname),
    imageUrl: mediaUrl(album.picUrl || item.picUrl || item.coverImgUrl, 'netease'),
    avatarUrl: avatarUrl(
      target.resource === 'playlist'
        ? record(item.creator).avatarUrl
        : portrait
          ? artist.img1v1Url || artist.picUrl
          : undefined,
      'netease',
    ),
    duration: number(item.duration) ? Number(item.duration) / 1000 : undefined,
    publishedAt: isoDate(item.publishTime || album.publishTime),
    itemCount: number(item.trackCount) || number(item.size),
  };
};

const fetchNetease = async (target: LinkCardTarget): Promise<LinkCardData> => {
  const path =
    target.resource === 'track'
      ? `song/detail?ids=${encodeURIComponent(`[${target.id}]`)}`
      : target.resource === 'album'
        ? `v1/album/${target.id}?id=${target.id}`
        : `playlist/detail?id=${target.id}`;
  const { body } = await readResource(`https://music.163.com/api/${path}`, 'netease', true);
  const json = record(JSON.parse(body));
  const data = parseNeteaseMetadata(json, target);
  if (!data.avatarUrl && target.resource !== 'playlist') {
    const item = record(target.resource === 'track' ? list(json.songs)[0] : json.album);
    const artist = record(item.artist || list(item.artists)[0]);
    data.avatarUrl = await fetchArtistAvatar('netease', artist.id);
  }
  return data;
};

export const getLinkCard = async (href: string, type?: LinkCardType): Promise<LinkCardData> => {
  let target = getLinkCardTarget(href);
  if (!target || (type && type !== target.type)) throw new Error('Unsupported link card');
  const key = target.url;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  const pending = requests.get(key);
  if (pending) return pending;
  const initial = target;
  const request = (async () => {
    let data: LinkCardData;
    let refreshFailed = false;
    try {
      if (!target.resource) {
        const resolved = await readResource(target.url, target.provider);
        target = getLinkCardTarget(resolved.url);
        if (!target?.resource || target.provider !== initial.provider)
          throw new Error('Unresolved link card');
      }
      if (target.provider === 'netease') {
        data = await fetchNetease(target);
      } else {
        const result = await readResource(target.url, target.provider);
        const resolved = getLinkCardTarget(result.url);
        if (!resolved || resolved.id !== target.id || resolved.resource !== target.resource) {
          throw new Error('Link card redirected to a different resource');
        }
        data = parseLinkCardMetadata(result.body, { ...target, url: resolved.url });
        if (
          target.provider === 'apple-music' &&
          target.resource !== 'playlist' &&
          !data.avatarUrl
        ) {
          const artist = jsonScripts(result.body)
            .map(appleArtist)
            .find(item => typeof item.url === 'string');
          data.avatarUrl = await fetchArtistAvatar('apple-music', artist?.url);
        }
      }
    } catch {
      refreshFailed = true;
      data = cached && !cached.data.unavailable ? cached.data : getLinkCardFallback(initial);
    }
    cache.delete(key);
    cache.set(key, { data, expires: Date.now() + (refreshFailed ? 60_000 : CACHE_TTL) });
    while (cache.size > 200) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return data;
  })().finally(() => requests.delete(key));
  requests.set(key, request);
  return request;
};
