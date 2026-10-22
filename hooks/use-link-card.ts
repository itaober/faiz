'use client';

import { useEffect, useState } from 'react';

import {
  getLinkCardFallback,
  getLinkCardTarget,
  type LinkCardData,
  type LinkCardType,
} from '@/lib/link-card';

const cache = new Map<string, { expires: number; request: Promise<LinkCardData> }>();
// Settled results, read synchronously so a card that re-mounts (link → card)
// paints at once instead of flashing its skeleton.
const resolved = new Map<string, LinkCardData>();

const cacheKey = (href: string, type?: LinkCardType) => {
  const target = getLinkCardTarget(href);
  return `${type || target?.type || ''}:${target?.url || href}`;
};

export const loadLinkCard = (href: string, type?: LinkCardType) => {
  const key = cacheKey(href, type);
  const current = cache.get(key);
  if (current && current.expires > Date.now()) return current.request;
  const params = new URLSearchParams({ url: href, ...(type ? { type } : {}) });
  const request = fetch(`/api/link-card?${params}`, { signal: AbortSignal.timeout(12_000) })
    .then(async response => {
      if (!response.ok) throw new Error('Unable to load link card');
      const data = (await response.json()) as LinkCardData;
      if (data.unavailable) cache.delete(key);
      else resolved.set(key, data);
      return data;
    })
    .catch(error => {
      cache.delete(key);
      throw error;
    });
  cache.delete(key);
  cache.set(key, { request, expires: Date.now() + 5 * 60 * 1000 });
  while (cache.size > 100) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.delete(oldest);
      resolved.delete(oldest);
    }
  }
  return request;
};

export default function useLinkCard(href: string, type?: LinkCardType) {
  const target = getLinkCardTarget(href);
  const valid = Boolean(target && (!type || target.type === type));
  const [result, setResult] = useState<{
    href: string;
    type?: LinkCardType;
    data: LinkCardData;
  } | null>(() => {
    const data = resolved.get(cacheKey(href, type));
    return data ? { href, type, data } : null;
  });
  useEffect(() => {
    const target = getLinkCardTarget(href);
    if (!target || (type && target.type !== type)) return;
    let active = true;
    loadLinkCard(href, type)
      .catch(() => getLinkCardFallback(target))
      .then(data => {
        if (active) setResult({ href, type, data });
      });
    return () => {
      active = false;
    };
  }, [href, type]);
  const current = result?.href === href && result.type === type ? result.data : null;
  return {
    data: current || (target ? getLinkCardFallback(target) : null),
    loading: valid && !current,
    valid,
  };
}
