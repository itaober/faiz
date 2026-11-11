/**
 * Tracks transient editor overlays (slash menu, etc.) so the global Esc-to-cancel
 * handler doesn't also fire when Escape is just dismissing an overlay. The slash
 * plugin removes its DOM synchronously on Escape, so a DOM presence check races;
 * this counter is cleared on the next tick instead.
 */
let openOverlayCount = 0;

export const markEditingOverlayOpen = () => {
  openOverlayCount += 1;
};

export const markEditingOverlayClosed = () => {
  // Defer so a keydown handler firing in the same tick still sees the overlay.
  setTimeout(() => {
    openOverlayCount = Math.max(0, openOverlayCount - 1);
  }, 0);
};

export const hasOpenEditingOverlay = () => openOverlayCount > 0;

/**
 * Component chips left open on a draft that isn't a valid component. Saving then would write
 * the original, so saves wait until each draft is applied or cancelled.
 */
const invalidDrafts = new Set<string>();

export const setInvalidDraft = (id: string, invalid: boolean) => {
  if (invalid) invalidDrafts.add(id);
  else invalidDrafts.delete(id);
};

export const hasInvalidDraft = () => invalidDrafts.size > 0;
