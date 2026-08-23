'use server';

import { revalidatePath } from 'next/cache';

import { isRecordType } from '@/lib/content-editing-validation';
import { type RecordItem, type Records, RecordsSchema } from '@/lib/data/data';
import { fetchGitHubJsonWithSha, writeGitHubJson } from '@/lib/data/github';
import dayjs, { formatTime } from '@/lib/dayjs';
import { requireAuth } from '@/lib/server/content-edit-token';
import {
  type ActionError,
  type ActionResult,
  createActionError,
  notFoundError,
  validationError,
} from '@/lib/types/action-result';

const RECORDS_PATH = 'data/records.json';

interface IRecordKey {
  title: string;
  type: RecordItem['type'];
  createdTime: string;
}

interface IRecordInput {
  record: RecordItem;
  token: string;
}

interface IUpdateRecordInput extends IRecordInput {
  original: IRecordKey;
}

interface IDeleteRecordInput {
  original: IRecordKey;
  token: string;
}

const createEmptyRecords = (): Records => ({
  book: [],
  movie: [],
  tv: [],
  music: [],
  game: [],
});

/**
 * Reads records with the revision they came from. A read failure propagates
 * rather than being read as "no records", which combined with a blind overwrite
 * would have replaced the whole file.
 */
const fetchRecordsWithSha = async (token: string): Promise<{ records: Records; sha?: string }> => {
  const file = await fetchGitHubJsonWithSha<unknown>(RECORDS_PATH, token);
  return {
    records: RecordsSchema.parse({ ...createEmptyRecords(), ...(file?.data ?? {}) }),
    sha: file?.sha,
  };
};

const sortRecordList = (records: RecordItem[]) =>
  [...records].sort((a, b) => dayjs(b.createdTime).diff(dayjs(a.createdTime)));

const validateRecordKey = (key: IRecordKey): ActionError | null => {
  if (!key?.title?.trim()) {
    return validationError('Record title is required');
  }

  if (!key?.createdTime?.trim()) {
    return validationError('Record createdTime is required');
  }

  if (!isRecordType(key?.type)) {
    return validationError('Invalid record type');
  }

  return null;
};

const findRecord = (records: Records, key: IRecordKey) => {
  if (!isRecordType(key.type)) {
    return undefined;
  }

  return records[key.type].find(
    record => record.title === key.title && record.createdTime === key.createdTime,
  );
};

const removeRecord = (records: Records, key: IRecordKey): Records => ({
  ...records,
  ...(isRecordType(key.type)
    ? {
        [key.type]: records[key.type].filter(
          record => !(record.title === key.title && record.createdTime === key.createdTime),
        ),
      }
    : {}),
});

const normalizeRecord = (record: RecordItem): RecordItem | ActionError => {
  if (!isRecordType(record?.type)) {
    return validationError('Invalid record type');
  }

  return {
    title: typeof record.title === 'string' ? record.title.trim() : '',
    link: typeof record.link === 'string' ? record.link.trim() : '',
    coverUrl: typeof record.coverUrl === 'string' ? record.coverUrl.trim() : '',
    createdTime:
      typeof record.createdTime === 'string' && record.createdTime.trim()
        ? record.createdTime.trim()
        : formatTime(),
    rating: typeof record.rating === 'number' && record.rating > 0 ? record.rating : undefined,
    comment: typeof record.comment === 'string' ? record.comment.trim() || undefined : undefined,
    type: record.type,
  };
};

// No retry-on-conflict here, unlike the posts index: this rewrites the whole
// records file, so replaying a stale in-memory copy would drop the other edit.
const writeRecords = async (records: Records, token: string, sha?: string) => {
  const sorted: Records = {
    book: sortRecordList(records.book),
    movie: sortRecordList(records.movie),
    tv: sortRecordList(records.tv),
    music: sortRecordList(records.music),
    game: sortRecordList(records.game),
  };

  await writeGitHubJson(RECORDS_PATH, sorted, `docs: update ${RECORDS_PATH}`, token, sha);
  revalidatePath('/records');
};

export async function createRecordAction(input: IRecordInput): Promise<ActionResult<RecordItem>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return validationError('Title, link, and cover are required');
    }

    const { records, sha } = await fetchRecordsWithSha(token);
    await writeRecords(
      {
        ...records,
        [record.type]: [record, ...records[record.type]],
      },
      token,
      sha,
    );

    return { success: true, data: record };
  } catch (error) {
    console.error('Failed to create record:', error);
    return createActionError(error, 'Failed to create record');
  }
}

export async function updateRecordAction(
  input: IUpdateRecordInput,
): Promise<ActionResult<RecordItem>> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const invalid = validateRecordKey(input.original);
    if (invalid) {
      return invalid;
    }

    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return validationError('Title, link, and cover are required');
    }

    const { records, sha } = await fetchRecordsWithSha(token);
    const existing = findRecord(records, input.original);

    if (!existing) {
      return notFoundError('Record not found');
    }

    const withoutOriginal = removeRecord(records, input.original);
    withoutOriginal[record.type] = [record, ...withoutOriginal[record.type]];
    await writeRecords(withoutOriginal, token, sha);

    return { success: true, data: record };
  } catch (error) {
    console.error('Failed to update record:', error);
    return createActionError(error, 'Failed to update record');
  }
}

export async function deleteRecordAction(input: IDeleteRecordInput): Promise<ActionResult> {
  const token = await requireAuth(input.token);
  if (typeof token !== 'string') {
    return token;
  }

  try {
    const invalid = validateRecordKey(input.original);
    if (invalid) {
      return invalid;
    }

    const { records, sha } = await fetchRecordsWithSha(token);
    const existing = findRecord(records, input.original);

    if (!existing) {
      return notFoundError('Record not found');
    }

    await writeRecords(removeRecord(records, input.original), token, sha);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete record:', error);
    return createActionError(error, 'Failed to delete record');
  }
}
