import type { MDXComponents } from 'mdx/types';
import NextImage from 'next/image';
import NextLink from 'next/link';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { AnchorHTMLAttributes, ImgHTMLAttributes } from 'react';

import ExternalLinkHoverCard from '@/components/external-link-hover-card';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import {
  groupConsecutiveMdxImages,
  normalizeEditorImageMarkup,
  unescapeMarkdownValue,
} from '@/lib/utils/editor-image';

import type { ICheckboxRootProps } from './checkbox';
import { Checkbox, CheckboxLabel, CheckboxRoot } from './checkbox';
import MdxColumns from './mdx-columns';
import MDXImageGallery from './mdx-image-gallery';
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

const Image = ({ src, alt = '', caption }: IImageProps) => {
  if (!src) {
    return null;
  }

  const imageSrc = unescapeMarkdownValue(String(src));
  const imageAlt = unescapeMarkdownValue(String(alt));
  const _caption = caption || imageAlt;
  const resolvedAlt = imageAlt.trim() || _caption || 'Content image';
  const previewLabel = `Open image preview${resolvedAlt ? `: ${resolvedAlt}` : ''}`;
  const imageSizes = '(max-width: 768px) calc(100vw - 3rem), 36rem';

  return (
    <Preview>
      <span className="not-prose mb-4 block w-full px-2">
        <PreviewTrigger
          as="span"
          previewSrc={imageSrc}
          ariaLabel={previewLabel}
          className="mx-auto block w-full max-w-xl overflow-hidden rounded-md md:rounded-lg"
        >
          <NextImage
            src={imageSrc}
            alt={resolvedAlt}
            width={0}
            height={0}
            sizes={imageSizes}
            className="fz-img-outline h-auto w-full"
          />
        </PreviewTrigger>
        {_caption ? (
          <span className="text-muted-foreground mt-2 block text-center text-sm">{_caption}</span>
        ) : null}
      </span>
      <PreviewPortal ariaLabel={`Image preview: ${resolvedAlt}`}>
        <PreviewImage src={imageSrc} alt={resolvedAlt} />
      </PreviewPortal>
    </Preview>
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
  img: Image,
};

export const MDX = (props: MDXRemoteProps) => {
  const source =
    typeof props.source === 'string'
      ? groupConsecutiveMdxImages(normalizeEditorImageMarkup(props.source))
      : props.source;

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
