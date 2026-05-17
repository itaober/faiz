import { createEditorPreloader } from '@/components/editing/preload-editor';

export const loadMemoEditorSurface = () => import('./memo-editor-surface');

export const memoEditorPreloader = createEditorPreloader(loadMemoEditorSurface);
