import { describe, expect, it } from "vitest";
import { assertVersionCanBeMutated, createScenarioBranch, freezeBaseline } from "./versioning";

describe("governança de versões", () => {
  const approved = { id: "v-approved", projectId: "p-1", state: "approved" as const, isImmutable: false };

  it("congela baseline aprovado e bloqueia mutação direta", () => {
    const baseline = freezeBaseline(approved);
    expect(baseline.isImmutable).toBe(true);
    expect(() => assertVersionCanBeMutated(baseline)).toThrow("Baseline congelado");
  });

  it("recusa congelar rascunho sem aprovação explícita", () => {
    expect(() => freezeBaseline({ id: "v-draft", projectId: "p-1", state: "draft", isImmutable: false })).toThrow("Somente uma versão aprovada");
  });

  it("cria branch rascunho conectado à versão pai", () => {
    const branch = createScenarioBranch({ branchId: "v-branch", parent: approved });
    expect(branch.parentVersionId).toBe("v-approved");
    expect(branch.state).toBe("draft");
    expect(() => assertVersionCanBeMutated(branch)).not.toThrow();
  });
});
