import type { MDXComponents } from 'mdx/types';
import NextLink from 'next/link';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';

import ExternalLinkHoverCard from '@/components/external-link-hover-card';
import MediaStrip from '@/components/media-strip';
import { isAssetKey, resolveAssetSrc } from '@/lib/assets';
import { getImageMeta } from '@/lib/data/images';
import { toRenderableMdx, unescapeMarkdownValue } from '@/lib/utils/editor-image';

import type { ICheckboxRootProps } from './checkbox';
import { Checkbox, CheckboxLabel, CheckboxRoot } from './checkbox';
import MdxColumns from './mdx-columns';
import MDXImageGallery from './mdx-image-gallery';
import MdxLinkCard from './mdx-link-card';
import MdxTweet from './mdx-tweet';
import ParticleImage from './particle-image';

interface ITodoListProps {
  readonly?: boolean;
  items: Array<
    {
      label: React.ReactNode;
    } & Omit<ICheckboxRootProps, 'children'>
  >;
}

const TodoList = ({ readonly = false, items }: ITodoListProps) => {
  return (
    <div className="flex flex-col gap-0.5">
      {items?.map((item, index) => {
        const { label, ...props } = item;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: labels are ReactNode, and an MDX todo list is static — position is its only stable identity
          <CheckboxRoot key={index} readonly={readonly} {...props}>
            <Checkbox />
            <CheckboxLabel>{label}</CheckboxLabel>
          </CheckboxRoot>
        );
      })}
    </div>
  );
};

const isValidExternalWebLink = (href: string) => {
  try {
    const url = new URL(href.startsWith('//') ? `https:${href}` : href);
    return Boolean(url.hostname);
  } catch {
    return false;
  }
};

const normalizeAbsoluteHref = (href: string) => {
  let normalized = '';
  for (const character of href) {
    const code = character.charCodeAt(0);
    if (code > 0x20 && code !== 0x7f) {
      normalized += character;
    }
  }
  return normalized;
};

interface MarkdownLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  hoverCard?: boolean;
}

const MarkdownLink = ({ href = '', children, hoverCard = true, ...props }: MarkdownLinkProps) => {
  const normalizedAbsoluteHref = normalizeAbsoluteHref(href);
  const externalWebLink = /^(https?:)?\/\//i.test(normalizedAbsoluteHref);

  if (externalWebLink) {
    if (hoverCard && isValidExternalWebLink(normalizedAbsoluteHref)) {
      return (
        <ExternalLinkHoverCard {...props} href={normalizedAbsoluteHref}>
          {children}
        </ExternalLinkHoverCard>
      );
    }
    return (
      <a {...props} href={normalizedAbsoluteHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  if (/^(mailto|tel):/i.test(normalizedAbsoluteHref)) {
    return (
      <a {...props} href={normalizedAbsoluteHref}>
        {children}
      </a>
    );
  }

  if (/^[a-z][a-z\d+.-]*:/i.test(normalizedAbsoluteHref)) {
    if (/^(javascript|data|vbscript):/i.test(normalizedAbsoluteHref)) {
      return <span>{children}</span>;
    }
    return (
      <a {...props} href={normalizedAbsoluteHref} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <NextLink href={href} {...props}>
      {children}
    </NextLink>
  );
};

interface IImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src?: string;
  alt?: string;
  caption?: string;
}

const Image = async ({ src, alt = '', caption }: IImageProps) => {
  if (!src) {
    return null;
  }

  const storedSrc = unescapeMarkdownValue(String(src));
  const imageAlt = unescapeMarkdownValue(String(alt)).trim();
  const label = caption || imageAlt;
  const meta = isAssetKey(storedSrc) ? await getImageMeta(storedSrc) : null;

  return (
    <span className="mb-4 block">
      <MediaStrip
        layout="article"
        items={[
          {
            src: resolveAssetSrc(storedSrc),
            alt: imageAlt || label || 'Content image',
            caption: label || undefined,
            width: meta?.width,
            height: meta?.height,
            blurDataURL: meta?.blurDataURL,
          },
        ]}
      />
    </span>
  );
};

const components: MDXComponents = {
  a: MarkdownLink,
  Link: MarkdownLink,
  CheckboxRoot,
  Checkbox,
  CheckboxLabel,
  TodoList,
  Columns: MdxColumns,
  Image,
  ImageGallery: MDXImageGallery,
  ParticleImage,
  Tweet: MdxTweet,
  LinkCard: MdxLinkCard,
  img: Image,
};

export const MDX = (props: MDXRemoteProps) => {
  const source = typeof props.source === 'string' ? toRenderableMdx(props.source) : props.source;

  return (
    <MDXRemote
      {...props}
      source={source}
      components={{ ...components, ...(props.components || {}) }}
      options={{
        blockJS: false,
        blockDangerousJS: true,
      }}
    />
  );
};
