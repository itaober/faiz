import type { MDXComponents } from 'mdx/types';
import NextImage from 'next/image';
import Link from 'next/link';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';
import type { ImgHTMLAttributes } from 'react';

import { Preview, PreviewImage, PreviewPortal, PreviewTrigger } from '@/components/preview';
import {
  groupConsecutiveMdxImages,
  normalizeEditorImageMarkup,
  unescapeMarkdownValue,
} from '@/lib/utils/editor-image';

import type { ICheckboxRootProps } from './checkbox';
import { Checkbox, CheckboxLabel, CheckboxRoot } from './checkbox';
import MDXImageGallery from './mdx-image-gallery';

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
      <span className="not-prose mb-4 block w-full px-2">
        <PreviewTrigger
          as="span"
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
  Link,
  CheckboxRoot,
  Checkbox,
  CheckboxLabel,
  TodoList,
  Image,
  ImageGallery: MDXImageGallery,
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
