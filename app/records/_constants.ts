import type { RecordType } from '@/lib/data/data';

export const tabList: { label: string; value: RecordType | 'all' }[] = [
  {
    label: 'All',
    value: 'all',
  },
  {
    label: 'Book',
    value: 'book',
  },
  {
    label: 'Movie',
    value: 'movie',
  },
  {
    label: 'TV',
    value: 'tv',
  },
  {
    label: 'Music',
    value: 'music',
  },
  {
    label: 'Game',
    value: 'game',
  },
] as const;

export type Tab = (typeof tabList)[number]['value'];
