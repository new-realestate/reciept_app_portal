import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../lib/apiClient";
import { Button, Field, Input } from "../../components/ui/ui";
import { AuthLayout } from "./AuthLayout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await authApi.requestPasswordReset(email);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new password."
      footer={
        <p>
          <Link to="/login">Back to sign in</Link>
        </p>
      }
    >
      {done ? (
        <div className="alert alert--success">If that email is registered, a reset link has been sent.</div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="alert alert--error">{error}</div>}
          <Field label="Email" htmlFor="email" required>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="btn--full" isLoading={isLoading}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
