import { Compass } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ButtonLink, EmptyState } from "../components/ui/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function NotFoundPage() {
  useDocumentTitle("Page not found");
  const { session } = useAuth();
  return (
    <main className="full-page-center">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or has moved."
        action={
          <ButtonLink to={session ? "/receipts" : "/login"}>{session ? "Go to receipts" : "Go to sign in"}</ButtonLink>
        }
      />
    </main>
  );
}
