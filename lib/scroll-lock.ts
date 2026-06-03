// Body scroll lock with a reference count, so concurrent overlays (image
// preview, memo gallery, …) don't clobber each other's saved styles: the body
// is only frozen on the first lock and restored on the last unlock.

let lockCount = 0;
let previousBodyOverflow: string | null = null;
let previousBodyPosition: string | null = null;
let previousBodyTop: string | null = null;
let previousBodyWidth: string | null = null;
let previousDocumentOverflow: string | null = null;
let previousScrollY = 0;

export const lockScroll = () => {
  if (lockCount === 0) {
    previousScrollY = window.scrollY;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyWidth = document.body.style.width;
    previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${previousScrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
  }

  lockCount += 1;
};

export const unlockScroll = () => {
  if (lockCount === 0) {
    return;
  }

  lockCount -= 1;

  if (lockCount === 0) {
    document.body.style.overflow = previousBodyOverflow ?? '';
    document.body.style.position = previousBodyPosition ?? '';
    document.body.style.top = previousBodyTop ?? '';
    document.body.style.width = previousBodyWidth ?? '';
    document.documentElement.style.overflow = previousDocumentOverflow ?? '';
    previousBodyOverflow = null;
    previousBodyPosition = null;
    previousBodyTop = null;
    previousBodyWidth = null;
    previousDocumentOverflow = null;
    window.scrollTo(0, previousScrollY);
    previousScrollY = 0;
  }
};
