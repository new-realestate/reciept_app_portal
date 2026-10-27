import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { applyBusinessTheme, buildBusinessTheme, contrastRatio } from "../lib/brandTheme";
import { AppShell } from "../components/layout/AppShell";
import { makeMe, renderWithApp } from "./helpers";

describe("business accent colour", () => {
  it("keeps a light colour readable by darkening it on light backgrounds", () => {
    const theme = buildBusinessTheme("#ffe600");
    expect(theme.adjusted).toBe(true);
    expect(contrastRatio(theme.light.brand, "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("uses the colour as-is when it's already readable, with white button text", () => {
    const theme = buildBusinessTheme("#1f7a5c");
    expect(theme.adjusted).toBe(false);
    expect(theme.light.brand).toBe("#1f7a5c");
    expect(theme.light.contrast).toBe("#ffffff");
  });

  it("lightens dark colours enough for the dark theme", () => {
    const theme = buildBusinessTheme("#1e1b4b");
    expect(contrastRatio(theme.dark.brand, "#161933")).toBeGreaterThanOrEqual(4.5);
  });

  it("applies and removes the theme for the whole page", () => {
    applyBusinessTheme("#1f7a5c");
    const style = document.getElementById("business-theme");
    expect(style?.textContent).toContain("--brand: #1f7a5c");
    expect(style?.textContent).toContain('[data-theme="dark"]');
    applyBusinessTheme(null);
    expect(document.getElementById("business-theme")).toBeNull();
  });
});

describe("branded shell", () => {
  it("shows the business name and logo instead of the product name", async () => {
    const me = makeMe("staff", {
      business: { id: "t1", name: "Palm Estates", logo_url: "https://example.com/logo.png", brand_color: "#1f7a5c" },
    });
    render(renderWithApp(<AppShell />, { me }));
    expect((await screen.findAllByText("Palm Estates")).length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Palm Estates logo").length).toBeGreaterThan(0);
    expect(screen.queryByText("Receipt Portal")).toBeNull();
  });
});
