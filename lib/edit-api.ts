import type { Memo } from '@/lib/data/memos-shared';
import type { RecordItem } from '@/lib/data/schemas';
import type { ActionResult } from '@/lib/types/action-result';
import type {
  EditableContent,
  EditableContentTarget,
  ICreateMemoInput,
  ICreatePostInput,
  IDeleteMemoInput,
  IDeletePostInput,
  IDeleteRecordInput,
  IPageSaveResult,
  IPostSaveResult,
  IRecordInput,
  IUpdateMemoInput,
  IUpdatePageInput,
  IUpdatePostInput,
  IUpdateRecordInput,
  IUploadEditorImageInput,
} from '@/worker/actions';

export type {
  EditableContent,
  EditableContentTarget,
  IPageSaveResult,
  IPostSaveResult,
} from '@/worker/actions';

/**
 * Client for the worker-hosted edit endpoints — same names, signatures and
 * ActionResult shape as the server actions they replaced, so the editor UIs
 * are unaware of the transport. Errors travel as values; only a network-level
 * failure becomes the NETWORK error here.
 */
const call = async <T = void>(name: string, input: unknown): Promise<ActionResult<T>> => {
  try {
    const res = await fetch(`/api/edit/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return (await res.json()) as ActionResult<T>;
  } catch (error) {
    console.error(`Edit request failed: ${name}`, error);
    return { success: false, error: 'Network error', code: 'NETWORK', retryable: true };
  }
};

export const createPostAction = (input: ICreatePostInput) =>
  call<IPostSaveResult>('create-post', input);

export const updatePostAction = (input: IUpdatePostInput) =>
  call<IPostSaveResult>('update-post', input);

export const deletePostAction = (input: IDeletePostInput) => call('delete-post', input);

export const updatePageAction = (input: IUpdatePageInput) =>
  call<IPageSaveResult>('update-page', input);

export const createRecordAction = (input: IRecordInput) => call<RecordItem>('create-record', input);

export const updateRecordAction = (input: IUpdateRecordInput) =>
  call<RecordItem>('update-record', input);

export const deleteRecordAction = (input: IDeleteRecordInput) => call('delete-record', input);

export const createMemoAction = (input: ICreateMemoInput) => call<Memo>('create-memo', input);

export const updateMemoAction = (input: IUpdateMemoInput) => call<Memo>('update-memo', input);

export const deleteMemoAction = (input: IDeleteMemoInput) => call('delete-memo', input);

export const uploadEditorImageAction = (input: IUploadEditorImageInput) =>
  call<string>('upload-image', input);

export const loadEditableContentAction = (target: EditableContentTarget) =>
  call<EditableContent>('load-content', target);
