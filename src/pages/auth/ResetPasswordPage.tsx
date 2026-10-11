import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../lib/apiClient";
import { Alert, Button, ButtonLink, Field, PasswordInput } from "../../components/ui/ui";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!token) {
      setError("Missing reset token. Use the link from your email.");
      return;
    }
    setIsLoading(true);
    try {
      await authApi.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password" footer={done ? undefined : <Link to="/login">Back to sign in</Link>}>
      {done ? (
        <div className="auth-form">
          <Alert tone="success">Your password has been updated. You can now sign in.</Alert>
          <ButtonLink to="/login" full>
            Go to sign in
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="New password" htmlFor="password" required hint="At least 8 characters.">
            <PasswordInput
              id="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" full isLoading={isLoading}>
            Update password
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
