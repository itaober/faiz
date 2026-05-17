'use client';

export const EDITOR_FLOATING_LAYER_SELECTOR =
  '[data-editor-slash-menu="true"], [data-editor-link-panel="true"]';

export const hasEditorFloatingLayer = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  return Boolean(document.querySelector(EDITOR_FLOATING_LAYER_SELECTOR));
};
