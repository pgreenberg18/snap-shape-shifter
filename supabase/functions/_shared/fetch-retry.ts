/**
 * fetchWithRetry — exponential back-off with jitter and Retry-After header support.
 * Retries on 429 (rate limit) and 5xx (server errors).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  opts: { maxRetries?: number; baseDelayMs?: number } = {},
): Promise<Response> {
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 1_000;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, init);

    if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
      return res;
    }

    if (attempt === maxRetries) return res;

    // Compute delay
    let delay = baseDelay * Math.pow(2, attempt);
    const retryAfter = res.headers.get("Retry-After");
    if (retryAfter) {
      const secs = parseInt(retryAfter, 10);
      if (!isNaN(secs)) delay = secs * 1_000;
    }
    // Add jitter (±25%)
    delay += delay * (Math.random() * 0.5 - 0.25);

    console.log(`[fetchWithRetry] attempt ${attempt + 1}/${maxRetries} failed (${res.status}), retrying in ${Math.round(delay)}ms`);
    await new Promise((r) => setTimeout(r, delay));
  }

  throw new Error("fetchWithRetry: unreachable");
}
