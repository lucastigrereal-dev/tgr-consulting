import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as builderModule from "./Builder";

const {
  FinancialModelModeSelector,
  createCotiaProjectMutationInput,
  getCotiaRegistrationFeedback,
} = builderModule;

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

  it("mantém TGR Canônico V2 como metodologia segura por padrão no payload Cotia", () => {
    expect(
      createCotiaProjectMutationInput({
        name: "Natal",
        assemblyName: "Montagem do Projeto",
        payload: { praca: "Natal/RN" },
      })
    ).toMatchObject({ financialModelMode: "TGR_CANONICAL_V2" });
  });

  it("transporta a escolha Harmony no payload sem apresentá-la como paridade aprovada", () => {
    expect(
      createCotiaProjectMutationInput({
        name: "Natal Harmony",
        assemblyName: "Montagem do Projeto",
        payload: { praca: "Natal/RN" },
        sourceRef: "PR #1 review",
        financialModelMode: "HARMONY_COMPAT_V1",
      })
    ).toMatchObject({
      name: "Natal Harmony",
      sourceRef: "PR #1 review",
      financialModelMode: "HARMONY_COMPAT_V1",
    });

    const html = renderToStaticMarkup(
      <FinancialModelModeSelector
        value="HARMONY_COMPAT_V1"
        onChange={() => undefined}
      />
    );
    expect(html).toContain("Metodologia financeira");
    expect(html).toContain("Harmony Compatível V1");
    expect(html).toContain("SOURCE_CONFLICT");
    expect(html).toContain("não representa paridade aprovada");
    expect(html).toContain('aria-describedby="financial-model-mode-help"');
    expect(html).toContain("focus-visible:ring-2");
  });

  it("não representa uma versão persistida desconhecida como TGR canônico", () => {
    const html = renderToStaticMarkup(
      <FinancialModelModeSelector
        value={null}
        onChange={() => undefined}
        disabled
      />
    );
    expect(html).toContain("NÃO IDENTIFICADO");
    expect(html).toContain("Conjunto de fórmulas sem metodologia registrada");
    expect(html).not.toContain("TGR_CANONICAL_V2");
  });
});
