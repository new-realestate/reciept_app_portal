import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../lib/apiClient";
import { Alert, ButtonLink, Spinner } from "../../components/ui/ui";
import { AuthLayout } from "./AuthLayout";

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("Missing verification token.");
      return;
    }
    authApi
      .verify(token)
      .then(() => setState("success"))
      .catch((err) => {
        setState("error");
        setMessage(err instanceof ApiError ? err.message : "Verification failed.");
      });
  }, [token]);

  return (
    <AuthLayout
      title="Email verification"
      footer={state === "success" ? undefined : <Link to="/login">Back to sign in</Link>}
    >
      {state === "loading" && <Spinner label="Verifying your email…" />}
      {state === "success" && (
        <div className="auth-form">
          <Alert tone="success">Your email is verified. You can now sign in.</Alert>
          <ButtonLink to="/login" full>
            Go to sign in
          </ButtonLink>
        </div>
      )}
      {state === "error" && (
        <div className="auth-form">
          <Alert tone="error">{message}</Alert>
        </div>
      )}
    </AuthLayout>
  );
}
