'use client';

import { MicAudioLinesIcon, MusicIcon } from 'lucide-react';
import { useState } from 'react';

import dayjs, { TIMEZONE } from '@/lib/dayjs';
import { LINK_CARD_PROVIDERS, LINK_CARD_RESOURCES, type LinkCardData } from '@/lib/link-card';
import { cn } from '@/lib/utils';

const formatDate = (value?: string) =>
  value && dayjs(value).isValid() ? dayjs(value).tz(TIMEZONE).format('MMM D, YYYY') : undefined;

const count = (value: number, unit: string) => `${value} ${unit}${value === 1 ? '' : 's'}`;

export default function LinkCard({
  data,
  preview = false,
  loading = false,
}: {
  data: LinkCardData;
  preview?: boolean;
  loading?: boolean;
}) {
  const [failedImage, setFailedImage] = useState('');
  const [failedAvatar, setFailedAvatar] = useState('');
  const podcast = data.type === 'podcast';
  const inset = data.resource === 'show';
  const image = data.imageUrl && failedImage !== data.imageUrl ? data.imageUrl : undefined;
  const avatar = data.avatarUrl && failedAvatar !== data.avatarUrl ? data.avatarUrl : undefined;
  const Icon = podcast ? MicAudioLinesIcon : MusicIcon;
  // The dark panel exists for white type over photos; without one, stay on the page's own palette.
  const dim = image ? 'text-white/80' : 'text-muted-foreground';
  const facts = [
    formatDate(data.publishedAt),
    data.duration
      ? `${Math.max(1, Math.round(data.duration / 60))} min`
      : data.itemCount
        ? count(data.itemCount, podcast ? 'episode' : 'track')
        : data.resource
          ? LINK_CARD_RESOURCES[data.resource]
          : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={preview ? -1 : undefined}
      onClick={preview ? event => event.preventDefault() : undefined}
      aria-busy={loading || undefined}
      data-link-card=""
      data-type={data.type}
      data-provider={data.provider}
      className="not-prose focus-ring bg-surface ring-border my-5 block w-full max-w-80 rounded-xl p-1 text-left no-underline ring-1 transition-shadow duration-150 hover:shadow-[var(--fz-shadow-md)]"
    >
      {/* Artwork panel: the cover carries the identity, like a share card. */}
      <span
        className={cn(
          'relative isolate block overflow-hidden rounded-lg',
          image ? 'bg-neutral-950 text-white' : 'bg-muted text-foreground',
          podcast ? 'aspect-[4/5]' : 'aspect-square',
          inset && 'grid grid-rows-[minmax(0,1fr)_auto]',
        )}
      >
        {podcast && !inset && image ? (
          // biome-ignore lint/performance/noImgElement: the ambient layer reuses the cached cover and keeps text off the sharp artwork
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full scale-125 object-cover opacity-25 blur-2xl"
          />
        ) : null}
        {image ? (
          // biome-ignore lint/performance/noImgElement: public provider images are allowlisted and have a local error fallback
          <img
            src={image}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailedImage(image)}
            className={cn(
              'absolute inset-x-0 top-0 w-full object-cover',
              inset
                ? 'size-full scale-125 opacity-50 blur-2xl'
                : podcast
                  ? 'aspect-square mask-[linear-gradient(to_bottom,black_35%,transparent_72%)]'
                  : 'aspect-square',
            )}
          />
        ) : (
          <Icon
            aria-hidden="true"
            className="text-muted-foreground/40 absolute top-[22%] left-1/2 size-14 -translate-x-1/2"
          />
        )}
        {image ? (
          <span
            className={cn(
              'absolute inset-0',
              podcast
                ? inset
                  ? 'bg-linear-to-t from-black/80 via-black/40 to-black/0'
                  : 'bg-black/10'
                : 'bg-linear-to-t from-black/95 via-black/70 via-35% to-black/0 to-70%',
            )}
            aria-hidden="true"
          />
        ) : null}
        {inset && image ? (
          <span className="relative row-start-1 flex min-h-0 items-center justify-center px-8 pt-4">
            {/* biome-ignore lint/performance/noImgElement: the inset uses the same cached provider image as the ambient background */}
            <img
              src={image}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="min-h-0 max-h-full max-w-full rounded-lg object-contain shadow-[0_8px_24px_oklch(0_0_0/0.3)] ring-1 ring-white/10"
              onError={() => setFailedImage(image)}
            />
          </span>
        ) : null}
        <span
          className={cn(
            'flex flex-col items-start p-4',
            inset ? 'relative row-start-2' : 'absolute inset-x-0 bottom-0',
          )}
        >
          {loading ? (
            <span
              role="status"
              aria-label="Loading link details"
              className="flex w-full flex-col gap-2 py-1 motion-safe:animate-pulse"
            >
              <span
                className={cn('h-5 w-4/5 rounded-sm', image ? 'bg-white/15' : 'bg-foreground/10')}
              />
              <span
                className={cn('h-3.5 w-1/2 rounded-sm', image ? 'bg-white/10' : 'bg-foreground/5')}
              />
            </span>
          ) : (
            <>
              {!inset && avatar ? (
                <span
                  className={cn(
                    'mb-2.5 block shrink-0 overflow-hidden bg-white/10 ring-1 ring-white/20',
                    podcast ? 'size-9 rounded-lg' : 'size-9 rounded-full',
                  )}
                >
                  {/* biome-ignore lint/performance/noImgElement: artist and podcast identity images have their own allowlist and failure state */}
                  <img
                    src={avatar}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-full object-cover"
                    onError={() => setFailedAvatar(avatar)}
                    data-link-card-avatar=""
                  />
                </span>
              ) : null}
              <span
                className={cn(
                  'text-lg leading-6 font-semibold text-pretty',
                  podcast && !inset ? 'line-clamp-3' : 'line-clamp-2',
                )}
              >
                {data.title}
              </span>
              {data.subtitle ? (
                <span className={cn('mt-1 max-w-full truncate text-[13px] leading-5', dim)}>
                  {data.subtitle}
                </span>
              ) : null}
              {data.description ? (
                <span className={cn('mt-2 line-clamp-2 text-[13px] leading-5', dim)}>
                  {data.description}
                </span>
              ) : null}
            </>
          )}
        </span>
      </span>
      {/* Meta row, aligned with the panel's own text inset: source left, facts right. */}
      <span
        className="text-muted-foreground flex items-center justify-between gap-3 px-3 pt-2 pb-0.5 text-xs leading-4 tabular-nums"
        data-link-card-meta=""
      >
        <span className="truncate">{LINK_CARD_PROVIDERS[data.provider]}</span>
        {facts ? <span className="shrink-0">{facts}</span> : null}
      </span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
