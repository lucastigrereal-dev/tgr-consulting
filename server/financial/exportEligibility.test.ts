import { describe, expect, it } from "vitest";
import { assertExportEligibility } from "./exportEligibility";

describe("bloqueio de exportação", () => {
  it("recusa snapshot sem autoridade, validação ou aprovação", () => {
    expect(() =>
      assertExportEligibility({
        isAuthoritative: false,
        validationStatus: "valid",
        approved: true,
        baselineFrozen: true,
      })
    ).toThrow("exige snapshot");
    expect(() =>
      assertExportEligibility({
        isAuthoritative: true,
        validationStatus: "failed",
        approved: true,
        baselineFrozen: true,
      })
    ).toThrow("exige snapshot");
    expect(() =>
      assertExportEligibility({
        isAuthoritative: true,
        validationStatus: "valid",
        approved: false,
        baselineFrozen: true,
      })
    ).toThrow("exige snapshot");
  });

  it("libera snapshot autoritativo, validado e aprovado", () => {
    const eligibleBaseline = {
      isAuthoritative: true,
      validationStatus: "valid",
      approved: true,
      baselineFrozen: true,
    };
    expect(() =>
      assertExportEligibility(eligibleBaseline)
    ).not.toThrow();
  });

  it("recusa snapshot aprovado cuja baseline ainda não foi congelada", () => {
    const approvedButMutable = {
      isAuthoritative: true,
      validationStatus: "valid",
      approved: true,
      baselineFrozen: false,
    };

    expect(() => assertExportEligibility(approvedButMutable)).toThrow(
      "baseline congelada"
    );
  });
});
