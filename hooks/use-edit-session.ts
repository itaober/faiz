import { useCallback, useEffect, useState } from 'react';

const SESSION_ENDPOINT = '/api/edit-session';

/**
 * Tracks whether this browser holds an edit session. The session itself is an httpOnly cookie,
 * so the client only ever learns a yes/no.
 */
export function useEditSession() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSessionLoaded, setIsSessionLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(SESSION_ENDPOINT, { cache: 'no-store' })
      .then(response => response.json() as Promise<{ signedIn?: boolean }>)
      .then(data => {
        if (!cancelled) {
          setIsSignedIn(data.signedIn === true);
        }
      })
      // A failed check leaves the editor signed out; saving then asks for the key.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setIsSessionLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (key: string) => {
    const response = await fetch(SESSION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to sign in');
    }

    setIsSignedIn(true);
  }, []);

  const signOut = useCallback(async () => {
    await fetch(SESSION_ENDPOINT, { method: 'DELETE' });
    setIsSignedIn(false);
  }, []);

  return {
    isSignedIn,
    isSessionLoaded,
    signIn,
    signOut,
  };
}
