import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";
import { AuthFrame } from "./Login";
import { requestPasswordReset } from "@/lib/auth-pages";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send the reset request. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="PASSWORD RECOVERY"
      title="Get a password reset link."
      description="Enter the email address used for your WalkQuote account. We will show the same confirmation whether or not an account matches."
    >
      {sent ? (
        <div className="auth-success" role="status"><CheckCircle2 size={17} /><span>If that email is connected to an account, a reset link is on the way. Check your inbox.</span></div>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field" htmlFor="reset-email"><span>Email address</span><div className="field-control"><input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" /></div></label>
          {error && <p className="auth-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Sending…" : "Send reset link"}<ArrowRight size={16} /></button>
        </form>
      )}
      <div className="auth-inline-links"><Link to="/login">Back to sign in</Link><Link to="/">Homeowner demo</Link></div>
    </AuthFrame>
  );
};

export default ForgotPassword;
