import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ResponsiveTableFrame } from "./ResponsiveTableFrame";

describe("ResponsiveTableFrame", () => {
  it("oferece consulta horizontal acessível e mantém a primeira coluna como referência", () => {
    const html = renderToStaticMarkup(
      <ResponsiveTableFrame label="Fluxo mensal">
        <table><thead><tr><th>Mês</th><th>Caixa</th></tr></thead></table>
      </ResponsiveTableFrame>
    );
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Fluxo mensal"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("Deslize horizontalmente");
    expect(html).toContain("sticky");
    expect(html).toContain("overscroll-x-contain");
  });
});
