import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { runAnalyzeRoom, type AnalyzeInput } from "./analyze-room.server";

const MAX_BODY_CHARS = 4_250_000;

/** True when the caller is signed in as the project administrator. */
async function callerIsAdmin() {
  const auth = getRequestHeader("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const client = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
  });
  const { data: claims } = await client.auth.getClaims(token);
  const userId = claims?.claims?.sub;
  if (!userId) return false;
  const { data } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  return data === true;
}

export const analyzeRoomFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): AnalyzeInput => {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid request.");
    if (JSON.stringify(input).length > MAX_BODY_CHARS) throw new Error("Invalid request.");
    return input as AnalyzeInput;
  })
  .handler(async ({ data }) => {
    // Guests may run live analysis within the daily limits; the administrator is exempt.
    const isAdmin = await callerIsAdmin();
    const address =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const result = await runAnalyzeRoom(data, address, { skipQuota: isAdmin });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return JSON.parse(JSON.stringify(result)) as any;
  });

/** Server check shown in the contractor inbox: confirms the usage store is reachable. */
export const analysisDiagnosticFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!(await callerIsAdmin())) throw new Error("Administrator access is required.");
  const { runUsageDiagnostic } = await import("./analyze-room.server");
  const address = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return runUsageDiagnostic(address);
});
