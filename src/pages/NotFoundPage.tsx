import { Link } from "react-router-dom";
import { EmptyState } from "../components/ui/ui";

export function NotFoundPage() {
  return (
    <div className="full-page-center">
      <EmptyState
        title="Page not found"
        description="The page you're looking for doesn't exist."
        action={
          <Link to="/receipts" className="btn btn--primary">
            Go to receipts
          </Link>
        }
      />
    </div>
  );
}
