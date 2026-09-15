import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authApi } from "../../api/auth";
import { ApiError } from "../../lib/apiClient";
import { Spinner } from "../../components/ui/ui";
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
    <AuthLayout title="Email verification" footer={<Link to="/login">Back to sign in</Link>}>
      {state === "loading" && <Spinner label="Verifying your email…" />}
      {state === "success" && <div className="alert alert--success">Your email is verified. You can now sign in.</div>}
      {state === "error" && <div className="alert alert--error">{message}</div>}
    </AuthLayout>
  );
}
