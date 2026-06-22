import type { Editor } from '@tiptap/core';

import type { MdxImageGalleryItem } from '@/lib/utils/editor-image';

type StageFiles = (files: File[]) => Promise<MdxImageGalleryItem[]>;

// Bridges the gallery node view to the editor's staging pipeline (mirrors
// image-preview-store): the editor registers the live closure, the node view
// reads it when its "add" button stages more files.
const registry = new WeakMap<Editor, StageFiles>();

export const registerGalleryStaging = (editor: Editor, stageFiles: StageFiles) => {
  registry.set(editor, stageFiles);
};

export const getGalleryStaging = (editor: Editor): StageFiles | undefined => registry.get(editor);
