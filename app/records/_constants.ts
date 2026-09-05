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

/** Types whose covers are 1:1 (letterboxed in the mixed 2:3 grid). */
export const SQUARE_COVER_TYPES: readonly RecordType[] = ['music'];

export const isSquareCoverType = (value: RecordType | Tab) =>
  SQUARE_COVER_TYPES.includes(value as RecordType);

export const normalizeTab = (value: string | null | undefined): Tab => {
  if (!value) {
    return 'all';
  }
  return tabList.find(tab => tab.value === value)?.value ?? 'all';
};
