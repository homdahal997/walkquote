import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight } from "lucide-react";
import { afterLoginPath, signIn } from "@/lib/auth-pages";

const BRAND_MARK =
  "https://ellprnxjjzatijdxcogk.supabase.co/storage/v1/render/image/public/files/chat-generated-images/project-clduq7bkofnka3ym75h8/d8db62f3-a1e7-423b-a9ca-86c883d2b113.webp?width=88&resize=contain&quality=75";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-shell">
      <header className="auth-topbar">
        <Link className="auth-brand" to="/" aria-label="WalkQuote home">
          <img src={BRAND_MARK} alt="" />
          <strong>WalkQuote</strong>
        </Link>
        <span className="auth-topbar-note">Private contractor access</span>
      </header>
      <main className="auth-main">
        <section className="auth-card">
          <p className="eyebrow"><span className="eyebrow-rule" /> {eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </section>
      </main>
      <footer className="auth-footer"><Link to="/">Back to the homeowner demo</Link><span>Secure account access</span></footer>
    </div>
  );
}

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      window.location.assign(afterLoginPath());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="ADMINISTRATOR SIGN-IN"
      title="Open the contractor inbox."
      description="Sign in with the project administrator account to review Demo Painting Co. estimate requests."
    >
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Link to="/" search={{ experience: "demo" }} className="inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-amber-300 px-4 py-3 text-center text-base font-bold leading-5 text-slate-950 transition hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">Or skip sign-in and explore the Interactive Demo →</Link>
        <p className="mt-2 text-sm leading-5 text-amber-950">The prepared sample opens without an account and stays separate from real room requests.</p>
      </div>
      <form className="auth-form" onSubmit={submit}>
        <label className="form-field" htmlFor="login-email"><span>Email address</span><div className="field-control"><input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" /></div></label>
        <label className="form-field" htmlFor="login-password"><span>Password</span><div className="field-control"><input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" /></div></label>
        {error && <p className="auth-error" role="alert"><AlertCircle size={15} />{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}<ArrowRight size={16} /></button>
      </form>
      <div className="auth-inline-links"><span>Need an account? <Link to="/signup">Create one</Link></span><Link to="/forgot-password">Forgot password?</Link></div>
    </AuthFrame>
  );
};

export default Login;
