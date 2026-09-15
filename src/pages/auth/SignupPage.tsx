import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../lib/apiClient";
import { Button, Field, Input } from "../../components/ui/ui";
import { AuthLayout } from "./AuthLayout";

export function SignupPage() {
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.signup({ business_name: businessName, full_name: fullName, email, password });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <AuthLayout title="Check your email" subtitle="We sent a verification link to confirm your account.">
        <div className="alert alert--success">
          Account created for <strong>{businessName}</strong>. Verify your email, then sign in.
        </div>
        <Button className="btn--full" onClick={() => navigate("/login")}>
          Go to sign in
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your business account"
      subtitle="Set up your landlord/business account to start issuing receipts."
      footer={
        <p>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="alert alert--error">{error}</div>}
        <Field label="Business name" htmlFor="business_name" required hint="Shown on your receipts as the letterhead.">
          <Input id="business_name" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </Field>
        <Field label="Your full name" htmlFor="full_name" required>
          <Input id="full_name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" required hint="At least 8 characters.">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" className="btn--full" isLoading={isLoading}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
