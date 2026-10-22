export type LinkCardType = 'music' | 'podcast';
export type LinkCardProvider = 'netease' | 'apple-music' | 'xiaoyuzhou';
export type LinkCardResource = 'track' | 'album' | 'playlist' | 'episode' | 'show';

export interface LinkCardTarget {
  url: string;
  type: LinkCardType;
  provider: LinkCardProvider;
  resource?: LinkCardResource;
  id?: string;
}

export interface LinkCardData extends LinkCardTarget {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  avatarUrl?: string;
  description?: string;
  publishedAt?: string;
  duration?: number;
  itemCount?: number;
  unavailable?: boolean;
}

export interface LinkCardProps {
  href: string;
  type?: LinkCardType;
  /**
   * Snapshot of the card taken when it was inserted, so the published page
   * renders without asking the provider again.
   */
  title?: string;
  subtitle?: string;
  image?: string;
  avatar?: string;
  description?: string;
  date?: string;
  duration?: number;
  count?: number;
}

const SNAPSHOT_TEXT = ['title', 'subtitle', 'image', 'avatar', 'description', 'date'] as const;
const SNAPSHOT_NUMBER = ['duration', 'count'] as const;

/** Provider names as they brand themselves. */
export const LINK_CARD_PROVIDERS: Record<LinkCardProvider, string> = {
  netease: '网易云音乐',
  'apple-music': 'Apple Music',
  xiaoyuzhou: '小宇宙',
};

export const LINK_CARD_RESOURCES: Record<LinkCardResource, string> = {
  track: 'Track',
  album: 'Album',
  playlist: 'Playlist',
  episode: 'Episode',
  show: 'Podcast',
};

const NETEASE_HOSTS = new Set(['music.163.com', 'm.music.163.com', 'y.music.163.com']);
const NETEASE_SHORT_HOSTS = new Set(['163cn.tv', '163cn.link']);

export const getLinkCardTarget = (value: string): LinkCardTarget | null => {
  try {
    const url = new URL(value.trim());
    if (
      !['https:', 'http:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.port ||
      value.length > 2048
    ) {
      return null;
    }
    const hostname = url.hostname.toLowerCase();
    if (NETEASE_SHORT_HOSTS.has(hostname) && /^\/[\w-]+\/?$/.test(url.pathname)) {
      return { url: `https://${hostname}${url.pathname}`, type: 'music', provider: 'netease' };
    }
    if (NETEASE_HOSTS.has(hostname)) {
      const path = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url;
      const resource = path.pathname.match(/^\/(?:m\/)?(song|album|playlist)\/?$/)?.[1];
      const id = path.searchParams.get('id');
      if (!resource || !id || !/^\d+$/.test(id)) return null;
      return {
        url: `https://music.163.com/${resource}?id=${id}`,
        type: 'music',
        provider: 'netease',
        resource: resource === 'song' ? 'track' : (resource as 'album' | 'playlist'),
        id,
      };
    }
    if (hostname === 'music.apple.com') {
      const match = url.pathname.match(
        /^\/([a-z]{2})\/(song|album|playlist)\/(?:[^/]+\/)?([\w.-]+)\/?$/i,
      );
      if (!match) return null;
      const [, , resource, collectionId] = match;
      const songId = url.searchParams.get('i');
      if (songId && !/^\d+$/.test(songId)) return null;
      if (
        resource === 'playlist' ? !/^pl\.[\w.-]+$/.test(collectionId) : !/^\d+$/.test(collectionId)
      ) {
        return null;
      }
      return {
        url: `https://music.apple.com${url.pathname}${songId ? `?i=${songId}` : ''}`,
        type: 'music',
        provider: 'apple-music',
        resource: resource === 'song' || songId ? 'track' : (resource as 'album' | 'playlist'),
        id: songId || collectionId,
      };
    }
    if (hostname === 'www.xiaoyuzhoufm.com' || hostname === 'xiaoyuzhoufm.com') {
      const match = url.pathname.match(/^\/(episode|podcast)\/([a-f\d]{24})\/?$/i);
      if (!match) return null;
      return {
        url: `https://www.xiaoyuzhoufm.com/${match[1]}/${match[2]}`,
        type: 'podcast',
        provider: 'xiaoyuzhou',
        resource: match[1] === 'episode' ? 'episode' : 'show',
        id: match[2],
      };
    }
    return null;
  } catch {
    return null;
  }
};

export const getLinkCardFallback = (target: LinkCardTarget): LinkCardData => ({
  ...target,
  title: LINK_CARD_PROVIDERS[target.provider],
  subtitle: target.resource ? LINK_CARD_RESOURCES[target.resource] : 'Music',
  unavailable: true,
});

export const toLinkCardProps = (data: LinkCardData): LinkCardProps => ({
  href: data.url,
  type: data.type,
  title: data.title,
  subtitle: data.subtitle,
  image: data.imageUrl,
  avatar: data.avatarUrl,
  description: data.description,
  date: data.publishedAt,
  duration: data.duration,
  count: data.itemCount,
});

const positive = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

/** Card data from a stored snapshot; null when the markup only carries the link. */
export const getLinkCardSnapshot = (props: LinkCardProps): LinkCardData | null => {
  const target = getLinkCardTarget(props.href);
  if (!target || !props.title) return null;
  return {
    ...target,
    title: props.title,
    subtitle: props.subtitle,
    imageUrl: props.image,
    avatarUrl: props.avatar,
    description: props.description,
    publishedAt: props.date,
    duration: positive(props.duration),
    itemCount: positive(props.count),
  };
};

export const formatLinkCard = (props: LinkCardProps) => {
  const escapeAttribute = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const attrs = [
    ['type', props.type],
    ['href', props.href],
    ...[...SNAPSHOT_TEXT, ...SNAPSHOT_NUMBER].map(key => [key, props[key]] as const),
  ]
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}="${escapeAttribute(String(value))}"`);
  return `<LinkCard ${attrs.join(' ')} />`;
};

export const parseLinkCardMarkup = (source: string): LinkCardProps | null => {
  if (!/^<LinkCard\b[\s\S]*?\/>$/.test(source.trim())) return null;
  const attrs = new Map(
    [...source.matchAll(/(?:^|\s)([a-z]+)\s*=\s*(["'])(.*?)\2/gs)].map(match => [
      match[1],
      match[3]
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&'),
    ]),
  );
  const href = attrs.get('href');
  const type = attrs.get('type');
  if (!href || (type && type !== 'music' && type !== 'podcast')) return null;
  const props: LinkCardProps = { href, ...(type ? { type: type as LinkCardType } : {}) };
  for (const key of SNAPSHOT_TEXT) {
    const value = attrs.get(key);
    if (value) props[key] = value;
  }
  for (const key of SNAPSHOT_NUMBER) {
    const value = positive(attrs.get(key));
    if (value) props[key] = value;
  }
  return props;
};
