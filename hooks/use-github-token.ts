import { useCallback, useEffect, useState } from 'react';

import { CONTENT_EDIT_CONFIGURED_SENTINEL } from '@/lib/content-edit-token';

const LEGACY_STORAGE_KEY = 'FAIZ_GITHUB_TOKEN';

/**
 * Manages the edit token session without exposing the raw token to client state.
 *
 * Existing localStorage tokens are migrated once into an httpOnly cookie.
 */
export function useGitHubToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTokenState = async () => {
      const legacyToken = localStorage.getItem(LEGACY_STORAGE_KEY);

      if (legacyToken) {
        const response = await fetch('/api/edit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: legacyToken }),
        });

        if (!response.ok) {
          throw new Error('Failed to migrate token');
        }

        localStorage.removeItem(LEGACY_STORAGE_KEY);
        if (!cancelled) {
          setToken(CONTENT_EDIT_CONFIGURED_SENTINEL);
        }
        return;
      }

      const response = await fetch('/api/edit-token', { cache: 'no-store' });
      const data = (await response.json()) as { configured?: boolean };
      if (!cancelled) {
        setToken(data.configured ? CONTENT_EDIT_CONFIGURED_SENTINEL : null);
      }
    };

    loadTokenState()
      .catch(() => {
        if (!cancelled) {
          setToken(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveToken = useCallback(async (newToken: string) => {
    const response = await fetch('/api/edit-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: newToken }),
    });

    if (!response.ok) {
      throw new Error('Failed to save token');
    }

    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setToken(CONTENT_EDIT_CONFIGURED_SENTINEL);
  }, []);

  const clearToken = useCallback(async () => {
    await fetch('/api/edit-token', { method: 'DELETE' });
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    setToken(null);
  }, []);

  return {
    token,
    isLoaded,
    saveToken,
    clearToken,
  };
}
