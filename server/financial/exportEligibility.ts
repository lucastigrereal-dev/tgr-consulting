export function assertExportEligibility(input: {
  isAuthoritative: boolean;
  validationStatus: string;
  approved: boolean;
}): void {
  if (
    !input.isAuthoritative ||
    input.validationStatus !== "valid" ||
    !input.approved
  ) {
    throw new Error(
      "A exportação exige snapshot autoritativo, validado e aprovado."
    );
  }
}
