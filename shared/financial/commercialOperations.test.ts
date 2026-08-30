import { describe, expect, it } from "vitest";
import {
  calculateCommissionLedger,
  calculateRoomCapacity,
  calculateTrainingEconomics,
  projectWorkforceCohorts,
  type CommissionPolicy,
} from "./commercialOperations";

describe("calculateRoomCapacity", () => {
  it("expõe gargalos físicos, funcionais, de fechamento e de fila no pico", () => {
    const result = calculateRoomCapacity({
      rooms: [{ roomId: "main", tables: "10", overflowTables: "2" }],
      operatingDaysPerMonth: "20",
      operatingHoursPerDay: "8",
      shifts: "2",
      averageTourDurationMinutes: "60",
      toursPerTable: "1",
      receptionists: "2",
      receptionCapacityPerPerson: "500",
      consultants: "3",
      consultantCapacityPerPerson: "300",
      closers: "2",
      closerSalesCapacityPerPerson: "20",
      saleRate: "0.05",
      peakFlowFactor: "2",
      maxWaitMinutes: "5",
      plannedToursMonthly: "1100",
      plannedSalesMonthly: "45",
    });

    expect(result.capacity).toMatchObject({
      physicalToursMonthly: "1920.00000000",
      physicalToursPeakHourly: "12.00000000",
      receptionToursMonthly: "1000.00000000",
      consultantToursMonthly: "900.00000000",
      limitedToursMonthly: "900.00000000",
      closerSalesMonthly: "40.00000000",
      limitedSalesMonthly: "40.00000000",
    });
    expect(result.bottlenecks).toEqual({ tours: "consultants", sales: "closers" });
    expect(result.queue.estimatedPeakWaitMinutes).toBe("8.75000000");
    expect(result.alerts.map(alert => alert.code)).toEqual(expect.arrayContaining([
      "tour_capacity_exceeded",
      "reception_capacity_exceeded",
      "consultant_capacity_exceeded",
      "closer_capacity_exceeded",
      "peak_queue_exceeded",
    ]));
  });
});

describe("projectWorkforceCohorts", () => {
  it("projeta treinamento, ramp, turnover, reposição, capacidade e custo por mês", () => {
    const result = projectWorkforceCohorts({
      horizonMonths: 3,
      cohorts: [{
        cohortId: "closers-jan",
        role: "closer",
        capacityUnit: "sales",
        headcount: "10",
        hireMonth: 0,
        trainingMonths: 1,
        certificationRate: "0.8",
        rampCurve: [
          { productiveAgeMonth: 0, productivityRate: "0.5" },
          { productiveAgeMonth: 1, productivityRate: "1" },
        ],
        matureProductivity: "10",
        absenteeismRate: "0.1",
        monthlyTurnoverRate: "0.1",
        fixedCompensation: "700",
        burden: "100",
        guarantee: "100",
        allowance: "100",
        replacementCost: "200",
      }],
    });

    expect(result.months.map(month => ({
      month: month.month,
      effectiveFte: month.effectiveFte,
      capacity: month.capacity,
      attrition: month.attrition,
      replacements: month.replacements,
      cost: month.totalCost,
    }))).toEqual([
      { month: 0, effectiveFte: "0.00000000", capacity: "0.00000000", attrition: "1.00000000", replacements: "1.00000000", cost: "10200.00000000" },
      { month: 1, effectiveFte: "3.24000000", capacity: "32.40000000", attrition: "1.00000000", replacements: "1.00000000", cost: "10200.00000000" },
      { month: 2, effectiveFte: "6.15600000", capacity: "61.56000000", attrition: "1.00000000", replacements: "1.00000000", cost: "10200.00000000" },
    ]);
  });
});

describe("calculateTrainingEconomics", () => {
  it("calcula certificação, meta produtiva, calendário e custo até produtividade", () => {
    const result = calculateTrainingEconomics({
      trainingId: "closer-academy",
      role: "closer",
      startMonth: 0,
      candidates: "100",
      classes: "4",
      durationMonths: 2,
      trainers: "2",
      trainerMonthlyCost: "5000",
      candidateMonthlySalary: "1000",
      monthlySupportCost: "2000",
      approvalRate: "0.8",
      certificationRate: "0.75",
      timeToProductiveMonths: 1,
      targetProductivePeople: "70",
      horizonMonths: 5,
    });

    expect(result.summary).toEqual({
      candidatesPerClass: "25.00000000",
      approvedPeople: "80.00000000",
      certifiedPeople: "60.00000000",
      productivePeople: "60.00000000",
      productiveMonth: 3,
      targetProductivePeople: "70.00000000",
      targetGap: "10.00000000",
      totalCostToProductive: "284000.00000000",
      costPerProductivePerson: "4733.33333333",
    });
    expect(result.months.map(month => month.cost)).toEqual([
      "112000.00000000",
      "112000.00000000",
      "60000.00000000",
      "0.00000000",
      "0.00000000",
    ]);
  });
});

const commissionPolicy = (): CommissionPolicy => ({
  policyId: "closer-gross-v1",
  role: "closer",
  eligibleBase: "gross_sales",
  mode: "percentage",
  fixedAmount: "0",
  percentageRate: "0.01",
  tiers: [{ fromAmount: "10000", rate: "0.02", accelerator: "1.5" }],
  guarantee: "0",
  cutoffDay: 15,
  paymentLagMonths: 1,
  qualityMultiplier: "0.8",
  holdbackRate: "0.1",
  reversalEnabled: true,
});

describe("calculateCommissionLedger", () => {
  it("aplica tiers marginais, qualidade, holdback, cutoff e payment lag", () => {
    const result = calculateCommissionLedger({
      policies: [commissionPolicy()],
      baseRecords: [
        { recordId: "jan", policyId: "closer-gross-v1", role: "closer", eligibleBase: "gross_sales", month: 0, day: 10, amount: "15000", isReversal: false },
        { recordId: "feb", policyId: "closer-gross-v1", role: "closer", eligibleBase: "gross_sales", month: 1, day: 20, amount: "10000", isReversal: false },
      ],
    });

    expect(result.accruals).toEqual([
      expect.objectContaining({ recordId: "jan", grossCommission: "200.00000000", holdback: "20.00000000", payableCommission: "180.00000000", paymentMonth: 1 }),
      expect.objectContaining({ recordId: "feb", grossCommission: "80.00000000", holdback: "8.00000000", payableCommission: "72.00000000", paymentMonth: 3 }),
    ]);
    expect(result.payments).toEqual([
      { month: 1, amount: "180.00000000" },
      { month: 3, amount: "72.00000000" },
    ]);
  });

  it("falha fechado quando policy/base/role/mês tenta contar a mesma base duas vezes", () => {
    expect(() => calculateCommissionLedger({
      policies: [commissionPolicy()],
      baseRecords: [
        { recordId: "a", policyId: "closer-gross-v1", role: "closer", eligibleBase: "gross_sales", month: 0, day: 10, amount: "10000", isReversal: false },
        { recordId: "b", policyId: "closer-gross-v1", role: "closer", eligibleBase: "gross_sales", month: 0, day: 11, amount: "5000", isReversal: false },
      ],
    })).toThrow("dupla contagem");
  });
});

describe("commercial operations validation", () => {
  it("falha fechado para inputs fisicamente ou financeiramente inválidos", () => {
    expect(() => calculateRoomCapacity({
      rooms: [{ roomId: "invalid", tables: "1.5", overflowTables: "0" }],
      operatingDaysPerMonth: "20",
      operatingHoursPerDay: "8",
      shifts: "2",
      averageTourDurationMinutes: "60",
      toursPerTable: "1",
      receptionists: "1",
      receptionCapacityPerPerson: "100",
      consultants: "1",
      consultantCapacityPerPerson: "100",
      closers: "1",
      closerSalesCapacityPerPerson: "10",
      saleRate: "0.1",
      peakFlowFactor: "1",
      maxWaitMinutes: "10",
      plannedToursMonthly: "10",
      plannedSalesMonthly: "1",
    })).toThrow("tables deve ser inteiro");

    expect(() => calculateTrainingEconomics({
      trainingId: "invalid",
      role: "closer",
      startMonth: 0,
      candidates: "10",
      classes: "1",
      durationMonths: 1,
      trainers: "1",
      trainerMonthlyCost: "1",
      candidateMonthlySalary: "1",
      monthlySupportCost: "1",
      approvalRate: "1.01",
      certificationRate: "1",
      timeToProductiveMonths: 0,
      targetProductivePeople: "1",
      horizonMonths: 1,
    })).toThrow("approvalRate deve estar entre 0 e 1");

    const noReversal = { ...commissionPolicy(), reversalEnabled: false };
    expect(() => calculateCommissionLedger({
      policies: [noReversal],
      baseRecords: [{
        recordId: "reversal",
        policyId: noReversal.policyId,
        role: noReversal.role,
        eligibleBase: noReversal.eligibleBase,
        month: 0,
        day: 1,
        amount: "100",
        isReversal: true,
      }],
    })).toThrow("reversão não permitida");
  });
});
