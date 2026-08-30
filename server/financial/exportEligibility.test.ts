import { describe, expect, it } from "vitest";
import { assertExportEligibility } from "./exportEligibility";

describe("bloqueio de exportação", () => {
  it("recusa snapshot sem autoridade, validação ou aprovação", () => {
    expect(() =>
      assertExportEligibility({
        isAuthoritative: false,
        validationStatus: "valid",
        approved: true,
      })
    ).toThrow("exige snapshot");
    expect(() =>
      assertExportEligibility({
        isAuthoritative: true,
        validationStatus: "failed",
        approved: true,
      })
    ).toThrow("exige snapshot");
    expect(() =>
      assertExportEligibility({
        isAuthoritative: true,
        validationStatus: "valid",
        approved: false,
      })
    ).toThrow("exige snapshot");
  });

  it("libera snapshot autoritativo, validado e aprovado", () => {
    expect(() =>
      assertExportEligibility({
        isAuthoritative: true,
        validationStatus: "valid",
        approved: true,
      })
    ).not.toThrow();
  });
});
