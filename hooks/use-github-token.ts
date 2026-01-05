import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'FAIZ_GITHUB_TOKEN';

/**
 * A generic hook for managing GitHub token in localStorage
 *
 * @returns Token state and operations
 */
export function useGitHubToken() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setToken(stored);
    setIsLoaded(true);
  }, []);

  const saveToken = useCallback((newToken: string) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    setToken(newToken);
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
  }, []);

  return {
    token,
    isLoaded,
    saveToken,
    clearToken,
  };
}
