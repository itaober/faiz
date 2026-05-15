import type { MDXComponents } from 'mdx/types';
import NextImage from 'next/image';
import Link from 'next/link';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { ImgHTMLAttributes } from 'react';

import { unescapeMarkdownValue } from '@/lib/utils/editor-image';

import type { ICheckboxRootProps } from './checkbox';
import { Checkbox, CheckboxLabel, CheckboxRoot } from './checkbox';
import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from './preview';

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
          <CheckboxRoot key={index} readonly={readonly} {...props}>
            <Checkbox />
            <CheckboxLabel>{label}</CheckboxLabel>
          </CheckboxRoot>
        );
      })}
    </div>
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
      <PreviewTrigger
        as="span"
        ariaLabel={previewLabel}
        className="not-prose mb-4 block w-full rounded-lg px-2"
      >
        <span className="relative flex w-full flex-col items-center">
          <NextImage
            src={imageSrc}
            alt={resolvedAlt}
            width={0}
            height={0}
            sizes={imageSizes}
            className="h-auto w-full max-w-xl rounded-md md:rounded-lg"
          />
          {_caption ? (
            <span className="text-muted-foreground mt-2 block text-center text-sm">{_caption}</span>
          ) : null}
        </span>
      </PreviewTrigger>
      <PreviewPortal ariaLabel={`Image preview: ${resolvedAlt}`}>
        <PreviewImage src={imageSrc} alt={resolvedAlt} />
      </PreviewPortal>
    </Preview>
  );
};

const components: MDXComponents = {
  Link,
  CheckboxRoot,
  Checkbox,
  CheckboxLabel,
  TodoList,
  Image,
  img: Image,
};

export const MDX = (props: MDXRemoteProps) => {
  return (
    <MDXRemote
      {...props}
      components={{ ...components, ...(props.components || {}) }}
      options={{
        blockJS: false,
        blockDangerousJS: true,
      }}
    />
  );
};
