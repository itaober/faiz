import { z } from 'zod';

import dayjs, { TIMEZONE } from '@/lib/dayjs';

// Memo schema and path helpers shared by the app's read path and the worker's
// write path — keep this module free of Next/React imports.

export const MemoSchema = z.object({
  id: z.string(),
  content: z.string(),
  images: z.array(z.string()).default([]),
  createdTime: z.string(),
  updatedTime: z.string().optional(),
});

export const MemoListSchema = z.array(MemoSchema);

export type Memo = z.infer<typeof MemoSchema>;
export type MemoList = z.infer<typeof MemoListSchema>;

export const MEMOS_DIR = 'data/memos';
const MEMOS_FILE_PREFIX = 'memos-';
const MEMOS_FILE_SUFFIX = '.json';

export const buildMemosPath = (month: string) =>
  `${MEMOS_DIR}/${MEMOS_FILE_PREFIX}${month}${MEMOS_FILE_SUFFIX}`;

export const parseMonthFromPath = (path: string) => {
  const filename = path.split('/').pop() ?? '';
  if (!filename.startsWith(MEMOS_FILE_PREFIX) || !filename.endsWith(MEMOS_FILE_SUFFIX)) {
    return null;
  }
  const month = filename.slice(
    MEMOS_FILE_PREFIX.length,
    filename.length - MEMOS_FILE_SUFFIX.length,
  );
  return /^\d{6}$/.test(month) ? month : null;
};

export const getMemoMonthFromCreatedTime = (createdTime?: string) => {
  if (!createdTime) {
    return null;
  }
  const parsed = dayjs.tz(createdTime, TIMEZONE);
  if (!parsed.isValid()) {
    return null;
  }
  return parsed.format('YYYYMM');
};

export const sortMemoList = (list: MemoList) =>
  [...list].sort((a, b) => b.createdTime.localeCompare(a.createdTime));
