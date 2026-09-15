import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../lib/apiClient";
import { Button, Field, Input } from "../../components/ui/ui";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/login">Back to sign in</Link>}>
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <div className="alert alert--error">{error}</div>}
        <Field label="New password" htmlFor="password" required hint="At least 8 characters.">
          <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="btn--full" isLoading={isLoading}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
