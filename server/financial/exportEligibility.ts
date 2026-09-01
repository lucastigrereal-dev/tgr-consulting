export function assertExportEligibility(input: {
  isAuthoritative: boolean;
  validationStatus: string;
  approved: boolean;
  baselineFrozen: boolean;
}): void {
  if (
    !input.isAuthoritative ||
    input.validationStatus !== "valid" ||
    !input.approved ||
    !input.baselineFrozen
  ) {
    throw new Error(
      "A exportação exige snapshot autoritativo, validado, aprovado e baseline congelada."
    );
  }
}
