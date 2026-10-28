import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { runAnalyzeRoom, type AnalyzeInput } from "./analyze-room.server";

const MAX_BODY_CHARS = 4_250_000;

export const analyzeRoomFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): AnalyzeInput => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request.");
    if (JSON.stringify(input).length > MAX_BODY_CHARS) throw new Error("Invalid request.");
    return input as AnalyzeInput;
  })
  .handler(async ({ data }) => {
    const address =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const result = await runAnalyzeRoom(data, address);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(JSON.stringify(result)) as any;
  });

/** Server check shown in the contractor inbox: confirms the usage store is reachable. */
export const analysisDiagnosticFn = createServerFn({ method: "POST" }).handler(async () => {
  const { runUsageDiagnostic } = await import("./analyze-room.server");
  const address = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return runUsageDiagnostic(address);
});
