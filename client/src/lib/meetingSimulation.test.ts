import { describe, expect, it } from "vitest";
import { simulateCaptadorChange } from "@shared/financial/meetingSimulator";
import type { FinancialInputSnapshot } from "@shared/financial/types";
import {
  buildMeetingScenarioInputs,
  buildMeetingScenarioCapturePoints,
  calculateMeetingDelta,
  isLatestMeetingResponse,
  isCurrentMeetingHypothesis,
  meetingSimulationSignature,
} from "./meetingSimulation";

const provided = (value: string) => ({ status: "provided" as const, value, sourceType: "assumption" as const, sourceRef: "baseline" });
const inputs: FinancialInputSnapshot = {
  qualifiedCouplesMonth1: provided("100"), qualifiedCouplesGrowthRate: provided("0"), conversionRate: provided("0.1"), averageTicket: provided("1000"),
  collectionRate: provided("0.8"), cancellationRate: provided("0.1"), variableCostRate: provided("0.2"), partnerShareRate: provided("0.05"),
  fixedCostMonthly: provided("1000"), payrollMonthly: provided("10000"), capexInitial: provided("5000"), preOperationMonths: provided("0"), entryValuePerContract: provided("100"),
  paymentCardViewMixRate: provided("1"), paymentCardViewMdrRate: provided("0"), paymentCardViewSettlementDays: provided("0"),
  paymentCardInstallmentMixRate: provided("0"), paymentCardInstallmentMdrRate: provided("0"), paymentCardInstallmentSettlementDays: provided("0"),
  paymentDebitMixRate: provided("0"), paymentDebitMdrRate: provided("0"), paymentDebitSettlementDays: provided("0"),
  paymentRecurringChequeMixRate: provided("0"), paymentRecurringChequeMdrRate: provided("0"), paymentRecurringChequeSettlementDays: provided("0"),
  paymentBoletoMixRate: provided("0"), paymentBoletoMdrRate: provided("0"), paymentBoletoSettlementDays: provided("0"), discountRateAnnual: provided("0.12"),
};

describe("meetingSimulation helpers", () => {
  it("constrói a branch a partir da baseline e troca somente inputs realmente simulados", () => {
    const baseline = structuredClone(inputs);
    const result = simulateCaptadorChange({
      inputs,
      horizonMonths: 12,
      captadorDelta: "0",
      qualifiedCouplesPerCaptadorMonth: "25",
      loadedCostPerCaptadorMonth: "0",
      targetGrossSalesMonth1: "20",
    });

    const built = buildMeetingScenarioInputs(inputs, result);

    expect(built.changedKeys).toEqual(["qualifiedCouplesMonth1"]);
    expect(built.inputs.qualifiedCouplesMonth1).toEqual({
      status: "provided",
      value: "200.00000000",
      sourceType: "current_decision",
      sourceRef: "boardroom",
    });
    expect(built.inputs.averageTicket).toEqual(inputs.averageTicket);
    expect(inputs).toEqual(baseline);
  });

  it("calcula delta absoluto e percentual sem dividir por zero", () => {
    expect(calculateMeetingDelta("120", "100")).toEqual({ absolute: 20, percent: 20 });
    expect(calculateMeetingDelta("0", "0")).toEqual({ absolute: 0, percent: null });
    expect(calculateMeetingDelta(null, "100")).toEqual({ absolute: null, percent: null });
  });

  it("persiste a meta de vendas escalando apenas a demanda dos pontos na branch", () => {
    const points = [{
      status: "provided" as const,
      sourceType: "assumption" as const,
      sourceRef: "baseline-point",
      definition: {
        pointId: "p1", name: "Ponto 1", channel: "Shopping", activationCost: "10", monthlyFixedCost: "20", costPerSale: "3",
        approaches: "1000", researchRate: "0.5", qualificationRate: "0.4", invitationRate: "0.8", appointmentRate: "0.75",
        showRate: "0.8", tourRate: "0.5", saleRate: "0.2", cannibalizationRate: "0.1", cashflowTreatment: "incremental" as const,
      },
    }];

    const scaled = buildMeetingScenarioCapturePoints(points, "10", "12");

    expect(scaled[0].definition).toEqual({ ...points[0].definition, approaches: "1200.00000000" });
    expect(scaled[0]).toMatchObject({ status: "provided", sourceType: "current_decision", sourceRef: "boardroom" });
    expect(points[0].definition.approaches).toBe("1000");
  });

  it("aceita resposta apenas quando request e assinatura ainda são os mais novos", () => {
    expect(isLatestMeetingResponse(3, 3, "target:120", "target:120")).toBe(true);
    expect(isLatestMeetingResponse(2, 3, "target:100", "target:120")).toBe(false);
    expect(meetingSimulationSignature({ target: "120", versionId: "v1" }))
      .toBe(meetingSimulationSignature({ versionId: "v1", target: "120" }));
    expect(isCurrentMeetingHypothesis("current", "target:120", "target:120")).toBe(true);
    expect(isCurrentMeetingHypothesis("current", "target:120", "")).toBe(false);
    expect(isCurrentMeetingHypothesis("calculating", "target:100", "target:120")).toBe(false);
  });
});
