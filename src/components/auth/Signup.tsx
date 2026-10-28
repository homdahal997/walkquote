import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, ArrowRight } from "lucide-react";
import { AuthFrame } from "./Login";
import { signUp } from "@/lib/auth-pages";

const Signup = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (name.trim().length < 2) {
      setError("Enter your name to create an account.");
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Use at least 8 characters, including a letter and a number.");
      return;
    }
    setBusy(true);
    try {
      await signUp(name.trim(), email.trim(), password);
      navigate({ to: "/" });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Account creation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthFrame
      eyebrow="CREATE AN ACCOUNT"
      title="Set up your WalkQuote account."
      description="Create an account with your name, email, and password. The estimate inbox remains available only to the project administrator."
    >
      <form className="auth-form" onSubmit={submit}>
        <label className="form-field" htmlFor="signup-name"><span>Full name</span><div className="field-control"><input id="signup-name" autoComplete="name" required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></div></label>
        <label className="form-field" htmlFor="signup-email"><span>Email address</span><div className="field-control"><input id="signup-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@business.com" /></div></label>
        <label className="form-field" htmlFor="signup-password"><span>Password</span><div className="field-control"><input id="signup-password" type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" /></div><small className="auth-helper">Use at least 8 characters with a letter and a number.</small></label>
        {error && <p className="auth-error" role="alert"><AlertCircle size={15} />{error}</p>}
        <button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}<ArrowRight size={16} /></button>
      </form>
      <div className="auth-inline-links"><span>Already have an account? <Link to="/login">Sign in</Link></span><Link to="/">Homeowner demo</Link></div>
    </AuthFrame>
  );
};

export default Signup;
