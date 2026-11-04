/** One retry layer for Meta HTTP failures; never replay denied or invalid requests. */
export async function fetchMetaWithRetry(
  request: (signal: AbortSignal) => Promise<Response>,
  options: { timeoutMs?: number; wait?: (ms: number) => Promise<void>; now?: () => number; random?: () => number } = {},
): Promise<Response> {
  const now = options.now ?? Date.now;
  const wait = options.wait ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + (options.timeoutMs ?? 55_000);
  const first = await request(AbortSignal.timeout(Math.max(1, deadline - now())));
  if (first.status !== 429 && first.status < 500) return first;
  const retryAfter = first.headers.get("Retry-After");
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  const specified = Number.isFinite(seconds) ? seconds * 1000 : retryAfter ? Date.parse(retryAfter) - now() : NaN;
  const delay = Number.isFinite(specified) ? Math.max(1000, specified) : 1000 + Math.floor((options.random ?? Math.random)() * 500);
  // Do not exceed the original request budget or disregard a long Retry-After.
  if (deadline - now() - delay < 5000) return first;
  await first.body?.cancel().catch(() => undefined);
  await wait(delay);
  return request(AbortSignal.timeout(Math.max(1, deadline - now())));
}