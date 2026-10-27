import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { hasPermission } from "../auth/permissions";
import { AppShell } from "../components/layout/AppShell";
import { RequirePerm } from "../components/RequirePerm";
import { makeMe, renderWithApp } from "./helpers";

describe("hasPermission", () => {
  it("gives owners and admins every permission", () => {
    expect(hasPermission(makeMe("owner"), "renters.kyc_review")).toBe(true);
    expect(hasPermission({ is_manager: true, permissions: [] }, "receipts.issue")).toBe(true);
  });

  it("limits staff to their flags", () => {
    const staff = makeMe("staff", { permissions: ["customers.view"] });
    expect(hasPermission(staff, "customers.view")).toBe(true);
    expect(hasPermission(staff, "receipts.issue")).toBe(false);
    expect(hasPermission(null, "customers.view")).toBe(false);
  });
});

describe("navigation", () => {
  it("shows management sections to owners", async () => {
    render(renderWithApp(<AppShell />, { me: makeMe("owner") }));
    expect(await screen.findByRole("link", { name: /^Team$/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /KYC review/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Audit log/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Properties/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Tenants/ })).toBeTruthy();
  });

  it("hides management sections and missing permissions from staff", async () => {
    const staff = makeMe("staff", { permissions: ["receipts.issue", "documents.view"] });
    render(renderWithApp(<AppShell />, { me: staff }));
    expect(await screen.findByRole("link", { name: /Properties/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Team$/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /KYC review/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Audit log/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Tenants/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /Customers/ })).toBeNull();
  });

  it("shows KYC review to staff reviewers", async () => {
    const reviewer = makeMe("staff", { permissions: ["renters.manage", "renters.kyc_review"] });
    render(renderWithApp(<AppShell />, { me: reviewer }));
    expect(await screen.findByRole("link", { name: /KYC review/ })).toBeTruthy();
  });
});

describe("RequirePerm", () => {
  it("explains when access is denied", () => {
    render(
      renderWithApp(
        <RequirePerm perm="customers.view">
          <p>secret customers</p>
        </RequirePerm>,
        { me: makeMe("staff", { permissions: [] }) },
      ),
    );
    expect(screen.getByText(/don't have access/i)).toBeTruthy();
    expect(screen.queryByText("secret customers")).toBeNull();
  });

  it("keeps manager-only pages from staff even with every flag", () => {
    render(
      renderWithApp(
        <RequirePerm managerOnly>
          <p>team page</p>
        </RequirePerm>,
        { me: makeMe("staff") },
      ),
    );
    expect(screen.queryByText("team page")).toBeNull();
  });

  it("renders the page when allowed", () => {
    render(
      renderWithApp(
        <RequirePerm perm="customers.view">
          <p>customers</p>
        </RequirePerm>,
        { me: makeMe("staff") },
      ),
    );
    expect(screen.getByText("customers")).toBeTruthy();
  });
});
