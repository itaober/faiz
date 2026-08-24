import type { Metadata } from 'next';

import { RSS_FEED_PATH } from '@/lib/constants/seo';

const MAX_DESCRIPTION_LENGTH = 160;

/** Resolved against `metadataBase`, which the root layout sets from meta.json. */
export const RSS_ALTERNATE_TYPES = {
  'application/rss+xml': [{ url: RSS_FEED_PATH, title: 'RSS Feed' }],
};

const stripMarkdown = (content: string) => {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[>#*_~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const buildDescription = (content?: string, fallback = '') => {
  const raw = content ? stripMarkdown(content) : '';
  const text = raw || fallback;
  if (!text) {
    return '';
  }
  if (text.length <= MAX_DESCRIPTION_LENGTH) {
    return text;
  }
  const clipped = text.slice(0, MAX_DESCRIPTION_LENGTH);
  const lastSpace = clipped.lastIndexOf(' ');
  return (lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trim();
};

interface BuildPageMetadataInput {
  title: string;
  description: string;
  canonical: string;
  metaTitle?: Metadata['title'];
  openGraph?: Metadata['openGraph'];
  twitter?: Metadata['twitter'];
}

export const buildPageMetadata = ({
  title,
  description,
  canonical,
  metaTitle,
  openGraph,
  twitter,
}: BuildPageMetadataInput): Metadata => {
  const baseOpenGraph = {
    title,
    description,
    url: canonical,
    type: 'website' as const,
  };

  const baseTwitter = {
    card: 'summary' as const,
    title,
    description,
  };

  const mergedOpenGraph = openGraph ? { ...baseOpenGraph, ...openGraph } : baseOpenGraph;
  const mergedTwitter = twitter ? { ...baseTwitter, ...twitter } : baseTwitter;

  return {
    title: metaTitle ?? title,
    description,
    alternates: {
      canonical,
      // Metadata replaces `alternates` wholesale rather than merging it, so a
      // page that only set `canonical` used to drop the root layout's feed
      // declaration and leave the site with no discoverable RSS at all.
      types: RSS_ALTERNATE_TYPES,
    },
    openGraph: mergedOpenGraph,
    twitter: mergedTwitter,
  };
};
