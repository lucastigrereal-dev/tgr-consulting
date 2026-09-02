import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Login from "./Login";

describe("staging login", () => {
  it("apresenta login real explicitamente identificado como staging", () => {
    const html = renderToStaticMarkup(<Login />);

    expect(html).toContain("TGR Consulting");
    expect(html).toContain("Ambiente de staging");
    expect(html).toContain('autoComplete="username"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain("Entrar com segurança");
    expect(html).not.toContain("Manus");
  });
});
