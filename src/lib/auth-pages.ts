import { supabase } from "@/integrations/supabase/client";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signUp(name: string, email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/contractor` },
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function resetPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Where to go after login: a same-origin `?from_url=` path, admins to the inbox, else "/". */
export async function afterLoginPath(user: { id: string } | null): Promise<string> {
  const raw = new URLSearchParams(window.location.search).get("from_url");
  if (!raw) {
    if (user) {
      try {
        const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (data === true) return "/contractor";
      } catch {
        // Fall through to the default path.
      }
    }
    return "/";
  }
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : "/";
  } catch {
    return "/";
  }
}
