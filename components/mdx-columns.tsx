import { Children, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface MdxColumnsProps {
  children: ReactNode;
  className?: string;
  widths?: number[];
}

export default function MdxColumns({ children, className, widths }: MdxColumnsProps) {
  const columns = Children.toArray(children);
  const hasValidWidths =
    widths?.length === columns.length && widths.every(width => Number.isFinite(width) && width > 0);
  const template = hasValidWidths
    ? widths.map(width => `minmax(0, ${width}fr)`).join(' ')
    : `repeat(${Math.max(columns.length, 1)}, minmax(0, 1fr))`;
  const style = { '--mdx-columns': template } as CSSProperties;

  return (
    <div
      data-columns={columns.length}
      style={style}
      className={cn(
        'grid grid-cols-1 gap-8 md:grid-cols-[var(--mdx-columns)] md:items-start md:gap-10 [&>*]:min-w-0',
        className,
      )}
    >
      {columns}
    </div>
  );
}
