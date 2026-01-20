interface IRetryOptions {
  retries?: number;
  initialDelay?: number;
  maxDelay?: number;
  retryOn?: (res: Response) => boolean;
}

const defaultRetryOn = (res: Response) => res.status === 429 || res.status >= 500;

export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: IRetryOptions = {},
): Promise<Response> {
  const { retries = 3, initialDelay = 1000, maxDelay = 10000, retryOn = defaultRetryOn } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);

      if (retryOn(res) && attempt < retries) {
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter
          ? Math.min(parseInt(retryAfter) * 1000, maxDelay)
          : Math.min(initialDelay * 2 ** attempt, maxDelay);

        console.warn(`Retrying ${url} after ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      return res;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < retries) {
        const delay = Math.min(initialDelay * 2 ** attempt, maxDelay);
        console.warn(`Network error, retrying ${url} after ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url} after ${retries} retries`);
}
