import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    user: { id: "user-1", email: "lucas@example.com", name: "" },
  }),
}));

vi.mock("@/hooks/useMobile", () => ({ useIsMobile: () => false }));
vi.mock("wouter", () => ({ useLocation: () => ["/study"] }));

import DashboardLayout from "./DashboardLayout";

describe("DashboardLayout", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      },
    });
  });

  it("expõe menu da conta e redimensionamento da sidebar para tecnologias assistivas", () => {
    const html = renderToStaticMarkup(
      <DashboardLayout>
        <main>Conteúdo do estudo</main>
      </DashboardLayout>
    );

    expect(html).toContain('aria-label="Abrir menu da conta"');
    expect(html).toContain("LU");
    expect(html).toContain('role="separator"');
    expect(html).toContain('aria-orientation="vertical"');
    expect(html).toContain('aria-label="Redimensionar navegação lateral"');
    expect(html).toContain('tabindex="0"');
  });
});
