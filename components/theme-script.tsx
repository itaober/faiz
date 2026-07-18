/* eslint-disable react/no-danger */

// Server component on purpose: rendering a <script> from a client component
// makes React 19 log "Encountered a script tag while rendering" on every
// client render. Keep the pre-hydration no-flash script server-only; the
// client-side re-sync lives in components/theme-sync.tsx.
const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('theme');
    var systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var resolvedTheme = theme === 'system' || !theme ? systemTheme : theme;

    if (resolvedTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {
    console.warn('Theme script error:', e);
  }
})();
`;

export function ThemeScript() {
  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />;
}
