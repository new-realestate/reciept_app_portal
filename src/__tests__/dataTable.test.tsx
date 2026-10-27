import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { DataTable, type Column } from "../components/ui/DataTable";

interface Row {
  id: string;
  name: string;
}

function Table({ onAction }: { onAction: () => void }) {
  const columns: Column<Row>[] = [
    { key: "name", header: "Name", cell: (r) => <Link className="table-link" to={`/items/${r.id}`}>{r.name}</Link> },
    { key: "note", header: "Note", cell: () => "Some text" },
    { key: "act", header: "", actions: true, cell: () => <button type="button" onClick={onAction}>Menu</button> },
  ];
  return <DataTable caption="Items" columns={columns} rows={[{ id: "7", name: "Seven" }]} rowKey={(r) => r.id} empty={null} />;
}

function renderTable(onAction = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/items"]}>
      <Routes>
        <Route path="/items" element={<Table onAction={onAction} />} />
        <Route path="/items/:id" element={<p>Item page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return onAction;
}

describe("DataTable rows", () => {
  it("open the row's link when clicked anywhere", async () => {
    renderTable();
    await userEvent.click(screen.getByText("Some text"));
    expect(await screen.findByText("Item page")).toBeTruthy();
  });

  it("leave buttons inside the row alone", async () => {
    const onAction = renderTable();
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Item page")).toBeNull();
  });
});
