import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAccess } from "../auth/AccessContext";
import type { Permission } from "../lib/types";
import { ButtonLink, EmptyState } from "./ui/ui";

/**
 * Shows the page only to members who hold `perm` (or, with `managerOnly`, to owners/admins).
 * Others see a clear "no access" message. The API enforces the same rule regardless.
 */
export function RequirePerm({
  perm,
  anyOf,
  managerOnly,
  children,
}: {
  perm?: Permission;
  anyOf?: Permission[];
  managerOnly?: boolean;
  children: ReactNode;
}) {
  const { can, isManager } = useAccess();
  const allowed =
    (managerOnly ? isManager : true) && (perm ? can(perm) : true) && (anyOf ? isManager || anyOf.some(can) : true);
  if (allowed) return <>{children}</>;
  return <NoAccess />;
}

export function NoAccess({ message }: { message?: string }) {
  return (
    <EmptyState
      icon={Lock}
      title="You don't have access to this page"
      description={message ?? "Ask your business owner or an admin if you need it."}
      action={
        <ButtonLink to="/dashboard" variant="secondary">
          Go to dashboard
        </ButtonLink>
      }
    />
  );
}
