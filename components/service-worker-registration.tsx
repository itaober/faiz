'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(error => {
        console.error('SW registration failed:', error);
      });
    };

    const scheduleRegister = () => {
      const requestIdleCallbackFn = (
        window as Window & {
          requestIdleCallback?: (cb: IdleRequestCallback, options?: IdleRequestOptions) => number;
        }
      ).requestIdleCallback;

      if (typeof requestIdleCallbackFn === 'function') {
        requestIdleCallbackFn(register, { timeout: 2000 });
        return;
      }

      setTimeout(register, 300);
    };

    if (document.readyState === 'complete') {
      scheduleRegister();
      return;
    }

    window.addEventListener('load', scheduleRegister, { once: true });
    return () => {
      window.removeEventListener('load', scheduleRegister);
    };
  }, []);

  return null;
}
