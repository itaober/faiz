type EditorLoader<T> = () => Promise<T>;

export const createEditorPreloader = <T>(loadEditor: EditorLoader<T>) => {
  let preloadPromise: Promise<T> | null = null;

  const preload = () => {
    preloadPromise ??= loadEditor().catch(error => {
      preloadPromise = null;
      throw error;
    });

    return preloadPromise;
  };

  const openAfterPreload = async (openEditor: () => void) => {
    await preload();
    openEditor();
  };

  return { openAfterPreload, preload };
};
