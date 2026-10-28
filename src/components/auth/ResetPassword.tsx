import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AuthFrame } from "./Login";
import { resetPassword } from "@/lib/auth-pages";

const ResetPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(location.searchStr).get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("This link is invalid. Request a new password reset link.");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Use at least 8 characters, including a letter and a number.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password);
      toast.success("Password updated. Sign in to continue.");
      navigate({ to: "/login" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not update the password. Request a new reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="PASSWORD RESET"
      title={token ? "Choose a new password." : "This link is invalid."}
      description={token ? "Set a new password for your WalkQuote account." : "The reset link is missing its token. Request a new link to continue."}
    >
      {token ? (
        <form className="auth-form" onSubmit={submit}>
          <label className="form-field" htmlFor="new-password"><span>New password</span><div className="field-control"><input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div><small className="auth-helper">Use at least 8 characters with a letter and a number.</small></label>
          {error && <p className="auth-error" role="alert"><AlertCircle size={15} />{error}</p>}
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "Updating password…" : "Update password"}<ArrowRight size={16} /></button>
        </form>
      ) : (
        <div className="auth-error" role="alert"><AlertCircle size={15} />This link is invalid. <Link to="/forgot-password">Request a new reset link.</Link></div>
      )}
      <div className="auth-inline-links"><Link to="/login">Back to sign in</Link><Link to="/forgot-password">Request another link</Link></div>
    </AuthFrame>
  );
};

export default ResetPassword;
