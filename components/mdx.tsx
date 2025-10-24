import type { MDXComponents } from 'mdx/types';
import Link from 'next/link';
import type { MDXRemoteProps } from 'next-mdx-remote/rsc';
import { MDXRemote } from 'next-mdx-remote/rsc';

import type { ICheckboxRootProps } from './checkbox';
import { Checkbox, CheckboxLabel, CheckboxRoot } from './checkbox';

interface ITodoListProps {
  readonly?: boolean;
  items: Array<
    ICheckboxRootProps & {
      label: string;
    }
  >;
}

const TodoList = ({ readonly = false, items }: ITodoListProps) => {
  return (
    <div className="flex flex-col gap-1">
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

const components: MDXComponents = {
  Link,
  CheckboxRoot,
  Checkbox,
  CheckboxLabel,
  TodoList,
};

export const MDX = (props: MDXRemoteProps) => {
  return <MDXRemote {...props} components={{ ...components, ...(props.components || {}) }} />;
};
