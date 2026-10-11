import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../lib/apiClient";
import { Alert, Button, Field, Input, PasswordInput } from "../../components/ui/ui";
import { AuthLayout } from "./AuthLayout";

export function LoginPage() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password });
      loginWithToken(res.access_token);
      navigate(location.state?.from ?? "/receipts", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to issue and manage receipts."
      footer={
        <>
          <p>
            <Link to="/forgot-password">Forgot your password?</Link>
          </p>
          <p>
            New here? <Link to="/signup">Create a business account</Link>
          </p>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email" htmlFor="email" required>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" full isLoading={isLoading}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
