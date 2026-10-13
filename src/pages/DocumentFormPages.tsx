import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileQuestion } from "lucide-react";
import { invoicesApi, quotationsApi } from "../api/documents";
import { ApiError } from "../lib/apiClient";
import type { Invoice, Quotation } from "../lib/documentTypes";
import { Alert, Card, EmptyState, ErrorState, PageHeader, Spinner } from "../components/ui/ui";
import { DocumentForm } from "../components/documents/DocumentForm";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export function NewInvoicePage() {
  useDocumentTitle("New invoice");
  return (
    <div>
      <PageHeader back={{ to: "/invoices", label: "Invoices" }} title="New invoice" subtitle="Save a draft, or issue it right away to get a number and a shareable link." />
      <DocumentForm kind="invoice" />
    </div>
  );
}

export function NewQuotationPage() {
  useDocumentTitle("New quotation");
  return (
    <div>
      <PageHeader back={{ to: "/quotations", label: "Quotations" }} title="New quotation" subtitle="An estimate for a customer to accept or decline. It is not a request for payment." />
      <DocumentForm kind="quotation" />
    </div>
  );
}

function useLoaded<T>(load: () => Promise<T>, key: string | undefined) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    load()
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError({ message: err instanceof ApiError ? err.message : "Could not load.", notFound: err instanceof ApiError && err.status === 404 }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { data, error };
}

export function EditInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data, error } = useLoaded<Invoice>(() => invoicesApi.get(invoiceId!), invoiceId);
  useDocumentTitle("Edit invoice");
  const back = { to: invoiceId ? `/invoices/${invoiceId}` : "/invoices", label: "Invoice" };

  if (error) return <LoadFailure title="Edit invoice" back={back} error={error} />;
  if (!data) return <div className="full-page-center"><Spinner label="Loading invoice…" /></div>;
  return (
    <div>
      <PageHeader back={back} title="Edit draft invoice" />
      {data.status !== "draft" ? (
        <Alert tone="warning">Only drafts can be edited. Once an invoice is issued its contents are fixed; cancel it and create a new one to make changes.</Alert>
      ) : (
        <DocumentForm kind="invoice" existing={data} />
      )}
    </div>
  );
}

export function EditQuotationPage() {
  const { quotationId } = useParams<{ quotationId: string }>();
  const { data, error } = useLoaded<Quotation>(() => quotationsApi.get(quotationId!), quotationId);
  useDocumentTitle("Edit quotation");
  const back = { to: quotationId ? `/quotations/${quotationId}` : "/quotations", label: "Quotation" };

  if (error) return <LoadFailure title="Edit quotation" back={back} error={error} />;
  if (!data) return <div className="full-page-center"><Spinner label="Loading quotation…" /></div>;
  return (
    <div>
      <PageHeader back={back} title="Edit draft quotation" />
      {data.status !== "draft" ? (
        <Alert tone="warning">Only drafts can be edited. A quotation that has been sent is fixed; cancel it and create a new one to change it.</Alert>
      ) : (
        <DocumentForm kind="quotation" existing={data} />
      )}
    </div>
  );
}

function LoadFailure({ title, back, error }: { title: string; back: { to: string; label: string }; error: { message: string; notFound: boolean } }) {
  return (
    <>
      <PageHeader title={title} back={back} />
      <Card>
        {error.notFound ? (
          <EmptyState icon={FileQuestion} title="Not found" description="It may have been removed, or the link is incorrect." />
        ) : (
          <ErrorState message={error.message} onRetry={() => window.location.reload()} />
        )}
      </Card>
    </>
  );
}
