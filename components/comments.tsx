'use client';

import Giscus from '@giscus/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * These ship in the HTML of every giscus-backed site, so they are configuration
 * rather than secrets. Regenerate at https://giscus.app if the repo ever moves.
 */
const GISCUS_REPO = 'itaober/faiz';
const GISCUS_REPO_ID = 'R_kgDOPZK7CA';
const GISCUS_CATEGORY = 'Announcements';
const GISCUS_CATEGORY_ID = 'DIC_kwDOPZK7CM4DEE3R';

export default function Comments() {
  const { resolvedTheme } = useTheme();
  // The stylesheet URL needs `window.location.origin` and the theme needs a
  // resolved colour scheme — neither exists until after hydration, so the value
  // is derived in an effect instead of during render.
  const [theme, setTheme] = useState<string>();

  useEffect(() => {
    const variant = resolvedTheme === 'dark' ? 'dark' : 'light';
    // giscus fetches the stylesheet from inside its own iframe, where localhost
    // is unreachable, so development falls back to the built-in themes.
    setTheme(
      process.env.NODE_ENV === 'production'
        ? `${window.location.origin}/giscus/${variant}.css`
        : variant,
    );
  }, [resolvedTheme]);

  // The reserved height keeps the page from jumping when the iframe reports its
  // own size.
  return (
    <section className="mt-16 min-h-70">
      {theme && (
        <Giscus
          repo={GISCUS_REPO}
          repoId={GISCUS_REPO_ID}
          category={GISCUS_CATEGORY}
          categoryId={GISCUS_CATEGORY_ID}
          mapping="pathname"
          strict="1"
          reactionsEnabled="1"
          theme={theme}
          lang="zh-CN"
          loading="lazy"
        />
      )}
    </section>
  );
}
