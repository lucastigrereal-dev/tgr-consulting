import { describe, expect, it } from "vitest";
import { getCotiaRegistrationFeedback } from "./Builder";

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
});
