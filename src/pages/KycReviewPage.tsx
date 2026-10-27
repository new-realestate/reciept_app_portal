import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { kycApi } from "../api/kyc";
import { ApiError } from "../lib/apiClient";
import { formatDateTime } from "../lib/format";
import type { KycQueueItem } from "../lib/propertyTypes";
import { Badge, Card, EmptyState, PageHeader } from "../components/ui/ui";
import { DataTable, type Column } from "../components/ui/DataTable";
import { KycStatusBadge } from "../components/ui/StatusBadge";
import { KycPanel } from "../components/kyc/KycPanel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const COLUMNS: Column<KycQueueItem>[] = [
  {
    key: "name",
    header: "Name",
    cell: (i) => (
      <Link className="table-link" to={`/kyc/${i.profile_id}`}>
        {i.subject_name ?? "Unnamed"}
      </Link>
    ),
  },
  { key: "type", header: "Who", cell: (i) => <Badge tone="neutral">{i.subject_type === "staff" ? "Staff member" : "Tenant"}</Badge> },
  { key: "submitted", header: "Submitted", cell: (i) => (i.submitted_at ? formatDateTime(i.submitted_at) : "—") },
  { key: "status", header: "Status", cell: (i) => <KycStatusBadge status={i.status} /> },
];

export function KycReviewPage() {
  useDocumentTitle("KYC review");
  const [items, setItems] = useState<KycQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setItems(await kycApi.queue());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load the review queue.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="KYC review" subtitle="Identity submissions waiting for a decision. Check each against its documents before approving." />
      <Card flush>
        <DataTable
          caption="Awaiting review"
          columns={COLUMNS}
          rows={items}
          rowKey={(i) => i.profile_id}
          isLoading={isLoading}
          error={error}
          onRetry={load}
          itemLabel="submissions"
          empty={<EmptyState icon={ShieldCheck} title="Nothing to review" description="New submissions you can review will appear here." />}
        />
      </Card>
    </div>
  );
}

export function KycProfilePage() {
  const { profileId = "" } = useParams();
  useDocumentTitle("KYC");
  const loadProfile = useCallback(() => kycApi.get(profileId), [profileId]);
  return (
    <div>
      <PageHeader back={{ to: "/kyc", label: "KYC review" }} title="KYC submission" />
      <KycPanel load={loadProfile} />
    </div>
  );
}
