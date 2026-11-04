import { describe, expect, it, vi } from "vitest";
import { fetchMetaWithRetry } from "@/lib/meta-retry";

describe("bounded Meta retries", () => {
  it.each([429, 500, 502, 503])("retries %s once after backoff", async (status) => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status })).mockResolvedValue(new Response("ok"));
    const wait = vi.fn().mockResolvedValue(undefined);
    expect((await fetchMetaWithRetry(request, { wait, random: () => 0 })).status).toBe(200);
    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(1000);
  });
  it.each([400, 401, 402, 403, 404, 200])("does not retry terminal status %s", async (status) => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status }));
    await fetchMetaWithRetry(request);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("stops after one retry even if Meta stays unavailable", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    expect((await fetchMetaWithRetry(request, { wait: async () => {} })).status).toBe(503);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("honors Retry-After", async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(null, { status: 429, headers: { "Retry-After": "3" } })).mockResolvedValue(new Response(null));
    const wait = vi.fn().mockResolvedValue(undefined);
    await fetchMetaWithRetry(request, { wait });
    expect(wait).toHaveBeenCalledWith(3000);
  });
  it("does not retry when Retry-After exceeds the time budget", async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 429, headers: { "Retry-After": "120" } }));
    const wait = vi.fn();
    await fetchMetaWithRetry(request, { wait });
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
  it("does not replay ambiguous network failures", async () => {
    const request = vi.fn().mockRejectedValue(new TypeError("network"));
    await expect(fetchMetaWithRetry(request)).rejects.toThrow("network");
    expect(request).toHaveBeenCalledTimes(1);
  });
});