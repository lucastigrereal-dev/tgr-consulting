import { describe, expect, it } from "vitest";
import { resolveRouteShell } from "./App";

describe("application route shells", () => {
  it("keeps /study outside the administrative dashboard shell", () => {
    expect(resolveRouteShell("/study")).toBe("boardroom");
    expect(resolveRouteShell("/builder")).toBe("admin");
  });
});
