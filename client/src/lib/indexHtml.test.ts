import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("documento HTML de entrada", () => {
  it("não publica URLs de analytics com placeholders não resolvidos", () => {
    const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

    expect(html).not.toContain("%VITE_ANALYTICS_");
  });
});
