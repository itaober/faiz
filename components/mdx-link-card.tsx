import { Suspense } from 'react';

import LinkCard from '@/components/link-card';
import {
  getLinkCardFallback,
  getLinkCardSnapshot,
  getLinkCardTarget,
  type LinkCardProps,
} from '@/lib/link-card';
import { getLinkCard } from '@/lib/server/link-card';

async function ResolvedLinkCard({ href, type }: LinkCardProps) {
  const data = await getLinkCard(href, type);
  return <LinkCard data={data} />;
}

export default function MdxLinkCard(props: LinkCardProps) {
  const { href, type } = props;
  const target = getLinkCardTarget(href);
  if (!target || (type && type !== target.type)) {
    let url: URL | undefined;
    try {
      url = new URL(href);
    } catch {
      /* Invalid MDX still leaves readable text. */
    }
    return url && ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? (
      <a href={url.toString()} target="_blank" rel="noopener noreferrer">
        {href}
      </a>
    ) : (
      <span>{href}</span>
    );
  }
  // A snapshot written by the editor renders as-is: no provider request at
  // build or request time. Older markup without one is still fetched.
  const snapshot = getLinkCardSnapshot(props);
  if (snapshot) {
    return <LinkCard data={snapshot} />;
  }
  return (
    <Suspense fallback={<LinkCard data={getLinkCardFallback(target)} loading />}>
      <ResolvedLinkCard href={target.url} type={type} />
    </Suspense>
  );
}
