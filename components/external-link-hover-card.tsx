'use client';

import { ExternalLinkIcon, Globe2Icon } from 'lucide-react';
import Image from 'next/image';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { useCallback, useEffect, useState } from 'react';

import HoverCard from '@/components/hover-card';
import Skeleton from '@/components/skeleton';
import { type LinkPreviewData, normalizeUrl } from '@/lib/link-preview-core';
import { cn } from '@/lib/utils';

type LinkPreviewRequest =
  | { href: string; status: 'loading' }
  | { href: string; status: 'success'; data: LinkPreviewData }
  | { href: string; status: 'error' };

interface ExternalLinkHoverCardProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href' | 'rel' | 'target'> {
  href: string;
  children: ReactNode;
}

const MAX_CLIENT_CACHE_ENTRIES = 100;
const previewCache = new Map<string, Promise<LinkPreviewData>>();

const normalizePreviewUrl = (href: string) => (href.startsWith('//') ? `https:${href}` : href);

const getFallbackData = (href: string): LinkPreviewData => {
  try {
    const url = new URL(normalizePreviewUrl(href));
    const hostname = url.hostname.replace(/^www\./i, '');
    return { url: url.toString(), hostname, title: hostname };
  } catch {
    return { url: href, hostname: 'External link', title: href };
  }
};

const getDisplayUrl = (value: string) => {
  try {
    const url = new URL(value);
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
    const search = url.search.length <= 32 ? url.search : '';
    const display = `${url.hostname.replace(/^www\./i, '')}${path}${search}`;
    return display.length <= 80 ? display : `${display.slice(0, 79)}…`;
  } catch {
    return value;
  }
};

// Previews for links already in the content ship as one static map built at
// deploy time; the worker endpoint only covers links newer than the build.
let staticPreviewsPromise: Promise<Record<string, LinkPreviewData>> | null = null;

const loadStaticPreviews = () => {
  staticPreviewsPromise ??= fetch('/link-previews.json')
    .then(response =>
      response.ok ? (response.json() as Promise<Record<string, LinkPreviewData>>) : {},
    )
    .catch(() => ({}));
  return staticPreviewsPromise;
};

const loadPreview = (href: string) => {
  const normalizedUrl = normalizePreviewUrl(href);
  const cached = previewCache.get(normalizedUrl);
  if (cached) {
    return cached;
  }

  const request = loadStaticPreviews()
    .then(async previews => {
      // Keys agree with scripts/build-link-previews.mjs because both normalize
      // through the same function.
      let baked: LinkPreviewData | undefined;
      try {
        baked = previews[normalizeUrl(normalizedUrl).toString()];
      } catch {
        // Not a previewable URL; fall through to the worker, which rejects it too.
      }
      if (baked) {
        return baked;
      }

      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(normalizedUrl)}`);
      if (!response.ok) {
        throw new Error('Unable to load link preview');
      }
      return (await response.json()) as LinkPreviewData;
    })
    .catch(error => {
      previewCache.delete(normalizedUrl);
      throw error;
    });
  previewCache.set(normalizedUrl, request);
  while (previewCache.size > MAX_CLIENT_CACHE_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    previewCache.delete(oldestKey);
  }
  return request;
};

export default function ExternalLinkHoverCard({
  href,
  children,
  className,
  'aria-describedby': ariaDescribedBy,
  ...props
}: ExternalLinkHoverCardProps) {
  const fallback = getFallbackData(href);
  const [isOpen, setIsOpen] = useState(false);
  const [request, setRequest] = useState<LinkPreviewRequest | null>(null);
  const [failedIcon, setFailedIcon] = useState<{ href: string; url: string } | null>(null);
  const currentRequest = request?.href === href ? request : null;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open) {
        setRequest(current => {
          if (current?.href === href && current.status !== 'error') {
            return current;
          }
          return { href, status: 'loading' };
        });
      }
    },
    [href],
  );

  useEffect(() => {
    if (!isOpen || currentRequest?.status === 'success' || currentRequest?.status === 'error') {
      return;
    }

    let active = true;
    loadPreview(href)
      .then(data => {
        if (active) {
          setRequest({ href, status: 'success', data });
        }
      })
      .catch(() => {
        if (active) {
          setRequest({ href, status: 'error' });
        }
      });

    return () => {
      active = false;
    };
  }, [currentRequest?.status, href, isOpen]);

  const currentPreview = currentRequest?.status === 'success' ? currentRequest.data : null;
  const isLoading = !currentRequest || currentRequest.status === 'loading';
  const data = currentPreview ?? fallback;
  const iconFailed = failedIcon?.href === href && failedIcon.url === data.iconUrl;
  const details = (
    <>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="bg-muted flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-sm">
          {data.iconUrl && !iconFailed ? (
            <Image
              src={data.iconUrl}
              alt=""
              aria-hidden="true"
              width={16}
              height={16}
              loading="eager"
              unoptimized
              onError={() => {
                if (data.iconUrl) {
                  setFailedIcon({ href, url: data.iconUrl });
                }
              }}
              className="size-4 object-contain"
            />
          ) : (
            <Globe2Icon aria-hidden="true" className="size-3.5" />
          )}
        </span>
        <span className="truncate">{data.siteName || data.hostname}</span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-sm leading-snug font-medium">{data.title}</p>
      {data.description ? (
        <p className="text-muted-foreground mt-1.5 line-clamp-2 text-xs leading-relaxed">
          {data.description}
        </p>
      ) : null}
      <p className="text-muted-foreground/70 mt-2 truncate font-mono text-[10px]">
        {getDisplayUrl(data.url)}
      </p>
    </>
  );
  const content = (
    <Skeleton
      loading={isLoading}
      loadingLabel="Loading link preview"
      fallback={
        <div className="motion-safe:animate-pulse motion-safe:[animation-duration:1s]">
          <div className="flex h-5 items-center gap-2">
            <span className="bg-muted size-5 rounded-sm" />
            <span className="bg-muted h-3 w-20 rounded-sm" />
          </div>
          <div className="mt-1.5 flex h-[1.125rem] items-center">
            <span className="bg-muted h-3.5 w-11/12 rounded-sm" />
          </div>
          <div className="mt-1.5 flex h-5 items-center">
            <span className="bg-muted h-2.5 w-full rounded-sm" />
          </div>
          <div className="mt-2 flex h-3.5 items-center">
            <span className="bg-muted h-2 w-1/2 rounded-sm" />
          </div>
        </div>
      }
    >
      {details}
    </Skeleton>
  );

  return (
    <HoverCard content={content} onOpenChange={handleOpenChange}>
      {triggerProps => {
        const describedBy = [ariaDescribedBy, triggerProps['aria-describedby']]
          .filter(Boolean)
          .join(' ');

        return (
          <a
            {...props}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-describedby={describedBy || undefined}
            className={cn('inline', className)}
          >
            {children}
            <ExternalLinkIcon
              aria-hidden="true"
              className="ml-0.5 inline size-3 align-[0.05em] opacity-55"
            />
            <span className="sr-only select-none">(opens in a new tab)</span>
          </a>
        );
      }}
    </HoverCard>
  );
}
