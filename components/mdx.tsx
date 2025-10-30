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
      {items.map((item, index) => {
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
  return (
    <Preview>
      <PreviewTrigger>
        <div className="relative w-full px-2">
          <NextImage
            src={src}
            alt={alt}
            width={0}
            height={0}
            sizes="100vw"
            className="h-auto w-full rounded-md md:rounded-lg"
          />
          {_caption && <figcaption>{_caption}</figcaption>}
        </div>
      </PreviewTrigger>
      <PreviewPortal>
        <PreviewImage src={src} alt={alt} />
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
  return <MDXRemote {...props} components={{ ...components, ...(props.components || {}) }} />;
};
