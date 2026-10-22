import { Suspense } from 'react';

import LinkCard from '@/components/link-card';
import { getLinkCardFallback, getLinkCardTarget, type LinkCardProps } from '@/lib/link-card';
import { getLinkCard } from '@/lib/server/link-card';

async function ResolvedLinkCard({ href, type }: LinkCardProps) {
  const data = await getLinkCard(href, type);
  return <LinkCard data={data} />;
}

export default function MdxLinkCard({ href, type }: LinkCardProps) {
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
  return (
    <Suspense fallback={<LinkCard data={getLinkCardFallback(target)} loading />}>
      <ResolvedLinkCard href={target.url} type={type} />
    </Suspense>
  );
}
