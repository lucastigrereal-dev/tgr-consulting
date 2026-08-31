import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorBoundary, { shouldShowErrorDetails } from "./ErrorBoundary";

function renderErroredBoundary(env: string) {
  const boundary = new ErrorBoundary({ children: <main>ok</main> });
  boundary.state = ErrorBoundary.getDerivedStateFromError(
    new Error("sensitive stack detail")
  );
  boundary.state.error!.stack = "Error: sensitive stack detail\n    at secret.ts:1";
  return renderToStaticMarkup(boundary.renderForEnvironment(env));
}

describe("ErrorBoundary", () => {
  it("não exibe stack trace ao usuário fora de desenvolvimento", () => {
    const html = renderErroredBoundary("production");

    expect(shouldShowErrorDetails("production")).toBe(false);
    expect(html).toContain("An unexpected error occurred.");
    expect(html).not.toContain("secret.ts");
    expect(html).not.toContain("sensitive stack detail");
  });

  it("mantém detalhe técnico disponível em desenvolvimento", () => {
    const html = renderErroredBoundary("development");

    expect(shouldShowErrorDetails("development")).toBe(true);
    expect(html).toContain("secret.ts");
  });
});
