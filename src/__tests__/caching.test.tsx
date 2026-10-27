import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useApiQuery } from "../hooks/useApiQuery";
import { apiRequest } from "../lib/apiClient";
import { clearQueryCache, queryClient } from "../lib/queryClient";

function Receipts({ fetcher }: { fetcher: () => Promise<string[]> }) {
  const { data, isLoading } = useApiQuery(["receipts", "test"], fetcher);
  return <p>{isLoading ? "loading" : data?.join(",")}</p>;
}

describe("cached reads", () => {
  it("show a page's data straight away when you come back to it", async () => {
    const client = queryClient; // the app's client, with its freshness settings
    client.clear();
    const fetcher = vi.fn(async () => ["RCT-1", "RCT-2"]);
    const view = render(
      <QueryClientProvider client={client}>
        <Receipts fetcher={fetcher} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("RCT-1,RCT-2")).toBeTruthy();
    view.unmount();

    // Navigating back: rendered from cache on the first paint, no loading state.
    render(
      <QueryClientProvider client={client}>
        <Receipts fetcher={fetcher} />
      </QueryClientProvider>,
    );
    expect(screen.getByText("RCT-1,RCT-2")).toBeTruthy();
    expect(fetcher).toHaveBeenCalledTimes(1); // still fresh, so not refetched
  });

  it("marks cached data stale after any successful change", async () => {
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "r1" }), { status: 201 }));
    await apiRequest("/receipts", { method: "POST", body: {} });
    expect(invalidate).toHaveBeenCalled();

    invalidate.mockClear();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await apiRequest("/receipts");
    expect(invalidate).not.toHaveBeenCalled(); // reads don't
  });

  it("forgets everything on logout", () => {
    queryClient.setQueryData(["receipts", "x"], ["secret"]);
    clearQueryCache();
    expect(queryClient.getQueryData(["receipts", "x"])).toBeUndefined();
  });
});
