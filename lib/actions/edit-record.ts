'use server';

import { revalidatePath } from 'next/cache';

import { isRecordType } from '@/lib/content-editing-validation';
import { CONTENT_KEYS } from '@/lib/content-keys';
import { type RecordItem, type Records, RecordsSchema } from '@/lib/data/data';
import { deleteImages } from '@/lib/data/images';
import dayjs, { formatTime } from '@/lib/dayjs';
import { StorageError } from '@/lib/errors';
import { requireEditSession } from '@/lib/server/edit-session';
import { readContentJsonForUpdate, writeContentJson } from '@/lib/storage/r2';
import {
  type ActionError,
  type ActionResult,
  createActionError,
  notFoundError,
  validationError,
} from '@/lib/types/action-result';

interface IRecordKey {
  title: string;
  type: RecordItem['type'];
  createdTime: string;
  /** The cover the editor loaded; a different stored cover means it changed elsewhere since. */
  coverUrl: string;
}

interface IRecordInput {
  record: RecordItem;
}

interface IUpdateRecordInput extends IRecordInput {
  original: IRecordKey;
}

interface IDeleteRecordInput {
  original: IRecordKey;
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
const readRecords = async (): Promise<{ records: Records; revision: string | null }> => {
  const file = await readContentJsonForUpdate<unknown>(CONTENT_KEYS.records);
  return {
    records: RecordsSchema.parse({ ...createEmptyRecords(), ...(file?.data ?? {}) }),
    revision: file?.revision ?? null,
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

  if (typeof key?.coverUrl !== 'string') {
    return validationError('Record cover is required');
  }

  return null;
};

const findRecord = (records: Records, key: IRecordKey) => {
  if (!isRecordType(key.type)) {
    return undefined;
  }

  const record = records[key.type].find(
    record => record.title === key.title && record.createdTime === key.createdTime,
  );
  // Saving over a cover replaced elsewhere would point at a deleted file and delete the new one.
  if (record && record.coverUrl !== key.coverUrl) {
    throw new StorageError(412, `Record changed since it was loaded: ${key.title}`);
  }
  return record;
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
const writeRecords = async (records: Records, revision: string | null) => {
  const sorted: Records = {
    book: sortRecordList(records.book),
    movie: sortRecordList(records.movie),
    tv: sortRecordList(records.tv),
    music: sortRecordList(records.music),
    game: sortRecordList(records.game),
  };

  await writeContentJson(CONTENT_KEYS.records, sorted, revision);
  revalidatePath('/records');
};

export async function createRecordAction(input: IRecordInput): Promise<ActionResult<RecordItem>> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  try {
    const record = normalizeRecord(input.record);
    if ('success' in record) {
      return record;
    }

    if (!record.title || !record.link || !record.coverUrl) {
      return validationError('Title, link, and cover are required');
    }

    const { records, revision } = await readRecords();
    await writeRecords(
      {
        ...records,
        [record.type]: [record, ...records[record.type]],
      },
      revision,
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
  const denied = await requireEditSession();
  if (denied) {
    return denied;
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

    const { records, revision } = await readRecords();
    const existing = findRecord(records, input.original);

    if (!existing) {
      return notFoundError('Record not found');
    }

    const withoutOriginal = removeRecord(records, input.original);
    withoutOriginal[record.type] = [record, ...withoutOriginal[record.type]];
    await writeRecords(withoutOriginal, revision);
    // A replaced cover was uploaded under a new key; the old file has nothing pointing at it.
    if (existing.coverUrl !== record.coverUrl) {
      await deleteImages([existing.coverUrl], 'records');
    }

    return { success: true, data: record };
  } catch (error) {
    console.error('Failed to update record:', error);
    return createActionError(error, 'Failed to update record');
  }
}

export async function deleteRecordAction(input: IDeleteRecordInput): Promise<ActionResult> {
  const denied = await requireEditSession();
  if (denied) {
    return denied;
  }

  try {
    const invalid = validateRecordKey(input.original);
    if (invalid) {
      return invalid;
    }

    const { records, revision } = await readRecords();
    const existing = findRecord(records, input.original);

    if (!existing) {
      return notFoundError('Record not found');
    }

    await writeRecords(removeRecord(records, input.original), revision);
    await deleteImages([existing.coverUrl], 'records');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete record:', error);
    return createActionError(error, 'Failed to delete record');
  }
}
