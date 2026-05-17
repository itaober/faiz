import { createEditorPreloader } from '@/components/editing/preload-editor';

export const loadRecordEditorSurface = () => import('./record-editor-surface');

export const recordEditorPreloader = createEditorPreloader(loadRecordEditorSurface);
