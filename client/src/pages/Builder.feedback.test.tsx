import { describe, expect, it } from "vitest";
import * as builderModule from "./Builder";

const { getCotiaRegistrationFeedback } = builderModule;

describe("feedback da reconciliação Cotia", () => {
  it("não declara condição reconciliada quando falta calendário indexado", () => {
    const feedback = getCotiaRegistrationFeedback([
      "Correção ou juros informados exigem calendário financeiro indexado; condição mantida PENDENTE até configuração.",
    ]);

    expect(feedback.kind).toBe("warning");
    expect(feedback.title).toContain("pendência");
    expect(feedback.description).toContain("calendário financeiro indexado");
    expect(feedback.description).not.toContain("condição reconciliada");
  });

  it("confirma reconciliação completa apenas sem warnings", () => {
    expect(getCotiaRegistrationFeedback([])).toMatchObject({
      kind: "success",
      title: "Página 1 reconciliada.",
    });
  });

  it("considera o draft Cotia ao decidir se deve bloquear a saída", () => {
    const hasUnsavedBuilderChanges = (
      builderModule as typeof builderModule & {
        hasUnsavedBuilderChanges?: (financialDirty: boolean, cotiaDirty: boolean) => boolean;
      }
    ).hasUnsavedBuilderChanges;

    expect(hasUnsavedBuilderChanges).toBeTypeOf("function");
    expect(hasUnsavedBuilderChanges?.(false, true)).toBe(true);
    expect(hasUnsavedBuilderChanges?.(true, false)).toBe(true);
    expect(hasUnsavedBuilderChanges?.(false, false)).toBe(false);
  });
});
