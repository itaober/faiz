// Reference-counted body scroll lock. Overflow mode keeps viewport coordinates
// stable for shared-layout animations; fixed mode preserves the stronger lock
// used by the existing modal/search surfaces.

export type ScrollLockMode = 'fixed' | 'overflow';

let fixedLockCount = 0;
let overflowLockCount = 0;
let activeLockMode: ScrollLockMode | null = null;
let previousBodyOverflow: string | null = null;
let previousBodyPaddingRight: string | null = null;
let previousBodyPosition: string | null = null;
let previousBodyTop: string | null = null;
let previousBodyWidth: string | null = null;
let previousDocumentOverflow: string | null = null;
let previousScrollY = 0;
let compensatedPaddingRight = 0;

const getLockCount = () => fixedLockCount + overflowLockCount;

const getNextMode = (): ScrollLockMode | null => {
  if (overflowLockCount > 0) {
    return 'overflow';
  }
  return fixedLockCount > 0 ? 'fixed' : null;
};

const leaveActiveMode = () => {
  document.body.style.overflow = previousBodyOverflow ?? '';
  document.documentElement.style.overflow = previousDocumentOverflow ?? '';

  if (activeLockMode === 'fixed') {
    document.body.style.position = previousBodyPosition ?? '';
    document.body.style.top = previousBodyTop ?? '';
    document.body.style.width = previousBodyWidth ?? '';
    window.scrollTo(0, previousScrollY);
  } else if (activeLockMode === 'overflow') {
    document.body.style.paddingRight = previousBodyPaddingRight ?? '';
  }
};

const applyMode = (mode: ScrollLockMode) => {
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';

  if (mode === 'fixed') {
    document.body.style.position = 'fixed';
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = '100%';
  } else if (compensatedPaddingRight > 0) {
    document.body.style.paddingRight = `${compensatedPaddingRight}px`;
  }
};

const clearSavedStyles = () => {
  activeLockMode = null;
  previousBodyOverflow = null;
  previousBodyPaddingRight = null;
  previousBodyPosition = null;
  previousBodyTop = null;
  previousBodyWidth = null;
  previousDocumentOverflow = null;
  previousScrollY = 0;
  compensatedPaddingRight = 0;
};

const syncLockMode = () => {
  const nextMode = getNextMode();

  if (nextMode === activeLockMode) {
    return;
  }

  if (activeLockMode) {
    leaveActiveMode();
  }

  activeLockMode = nextMode;

  if (nextMode) {
    applyMode(nextMode);
  } else {
    clearSavedStyles();
  }
};

export const lockScroll = (mode: ScrollLockMode = 'fixed') => {
  if (getLockCount() === 0) {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const paddingRight = Number.parseFloat(getComputedStyle(document.body).paddingRight) || 0;

    previousScrollY = window.scrollY;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPaddingRight = document.body.style.paddingRight;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyWidth = document.body.style.width;
    previousDocumentOverflow = document.documentElement.style.overflow;
    compensatedPaddingRight = scrollbarWidth > 0 ? paddingRight + scrollbarWidth : 0;
  }

  if (mode === 'fixed') {
    fixedLockCount += 1;
  } else {
    overflowLockCount += 1;
  }

  syncLockMode();
};

export const unlockScroll = (mode: ScrollLockMode = 'fixed') => {
  if (mode === 'fixed') {
    if (fixedLockCount === 0) {
      return;
    }
    fixedLockCount -= 1;
  } else {
    if (overflowLockCount === 0) {
      return;
    }
    overflowLockCount -= 1;
  }

  syncLockMode();
};
