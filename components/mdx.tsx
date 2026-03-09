import type { MDXComponents } from 'mdx/types';
import NextImage from 'next/image';
import Link from 'next/link';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';

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

interface IImageProps {
  src: string;
  alt: string;
  caption?: string;
}

const Image = ({ src, alt, caption }: IImageProps) => {
  const _caption = caption || alt;
  const resolvedAlt = alt?.trim() || _caption || 'Content image';
  const previewLabel = `Open image preview${resolvedAlt ? `: ${resolvedAlt}` : ''}`;
  const imageSizes = '(max-width: 768px) calc(100vw - 3rem), 36rem';

  return (
    <Preview>
      <PreviewTrigger ariaLabel={previewLabel} className="mb-4 w-full rounded-lg px-2">
        <figure className="relative flex w-full flex-col items-center">
          <NextImage
            src={src}
            alt={resolvedAlt}
            width={0}
            height={0}
            sizes={imageSizes}
            className="h-auto w-full max-w-xl rounded-md md:rounded-lg"
          />
          {_caption && <figcaption>{_caption}</figcaption>}
        </figure>
      </PreviewTrigger>
      <PreviewPortal ariaLabel={`Image preview: ${resolvedAlt}`}>
        <PreviewImage src={src} alt={resolvedAlt} />
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
