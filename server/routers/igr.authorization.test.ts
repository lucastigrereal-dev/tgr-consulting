import { describe, expect, it } from "vitest";
import { igrRouter } from "./igr";
import type { TrpcContext } from "../_core/context";

function contextFor(role: "user" | "admin"): TrpcContext {
  return {
    user: { id: 99, openId: "igr-test", name: "IGR Test", email: "test@example.com", loginMethod: "manus", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("igr authorization", () => {
  it("bloqueia aprovação por usuário sem papel administrativo antes de tocar no banco", async () => {
    const caller = igrRouter.createCaller(contextFor("user"));
    await expect(caller.approveSnapshot({ snapshotId: "snapshot-test", rationale: "Racional de teste" })).rejects.toThrow("Somente administrador técnico");
  });

  it("bloqueia congelamento de baseline por usuário sem papel administrativo", async () => {
    const caller = igrRouter.createCaller(contextFor("user"));
    await expect(caller.freezeBaseline({ snapshotId: "snapshot-test" })).rejects.toThrow("Somente administrador técnico");
  });

  it("rejeita valor não decimal do catálogo na fronteira da API", async () => {
    const caller = igrRouter.createCaller(contextFor("user"));
    await expect(caller.createCostCatalogItem({ versionId: "version-test", category: "operations", name: "Custo operacional", frequency: "monthly", amountText: "doze-mil", status: "provided", sourceType: "current_decision" })).rejects.toThrow();
  });

  it("rejeita componente do Builder sem nome mínimo antes de tocar no banco", async () => {
    const caller = igrRouter.createCaller(contextFor("user"));
    await expect(caller.upsertBuilderComponent({ versionId: "version-test", componentType: "costs_workforce", name: "x", status: "pending", payload: {}, sourceType: "current_decision" })).rejects.toThrow();
  });

  it("rejeita custo informado sem fonte antes de tocar no banco", async () => {
    const caller = igrRouter.createCaller(contextFor("user"));
    await expect(caller.createCostCatalogItem({ versionId: "version-test", category: "operations", name: "Custo operacional", frequency: "monthly", amountText: "12000", status: "provided", sourceType: "current_decision" })).rejects.toThrow("Custo informado exige fonte");
  });

  it("rejeita decisão sem fonte antes de tocar no banco", async () => {
    const caller = igrRouter.createCaller(contextFor("user"));
    await expect(caller.createDecision({ versionId: "version-test", title: "Decisão de teste", decisionValue: "0.1", rationale: "Racional verificável", responsible: "Comitê" })).rejects.toThrow();
  });
});
