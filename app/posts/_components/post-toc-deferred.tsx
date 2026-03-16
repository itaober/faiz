'use client';

import { type ComponentType, useEffect, useState } from 'react';

export default function PostTocDeferred() {
  const [TocComponent, setTocComponent] = useState<ComponentType | null>(null);

  useEffect(() => {
    let disposed = false;
    let loadListenerBound = false;

    const load = async () => {
      const tocModule = await import('./post-toc');
      if (!disposed) {
        setTocComponent(() => tocModule.default);
      }
    };

    const schedule = () => {
      const mount = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            load().catch(() => {});
          });
        });
      };

      if ('fonts' in document && document.fonts?.ready) {
        document.fonts.ready.then(mount).catch(mount);
      } else {
        mount();
      }
    };

    if (document.readyState === 'complete') {
      schedule();
    } else {
      loadListenerBound = true;
      window.addEventListener('load', schedule, { once: true });
    }

    return () => {
      disposed = true;
      if (loadListenerBound) {
        window.removeEventListener('load', schedule);
      }
    };
  }, []);

  if (!TocComponent) {
    return null;
  }

  return <TocComponent />;
}
