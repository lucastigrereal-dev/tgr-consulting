import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculatePointEconomics,
  type PointEconomicsInput,
} from "./pointEconomics";

const point = (
  overrides: Partial<PointEconomicsInput> = {},
): PointEconomicsInput => ({
  pointId: "airport",
  name: "Aeroporto",
  channel: "OPC",
  activationCost: "1000",
  monthlyFixedCost: "500",
  costPerSale: "100",
  approaches: "1000",
  researchRate: "0.8",
  qualificationRate: "0.5",
  invitationRate: "0.5",
  appointmentRate: "0.5",
  showRate: "0.8",
  tourRate: "0.75",
  saleRate: "0.2",
  averageTicket: "10000",
  averageEntry: "2000",
  contributionMarginRate: "0.3",
  healthyD90Rate: "0.8",
  cannibalizationRate: "0.25",
  cashflowTreatment: "incremental",
  ...overrides,
});

describe("calculatePointEconomics", () => {
  it("calcula o funil sequencial e separa produção total, incremental e canibalizada", () => {
    const result = calculatePointEconomics({ points: [point()] });
    const airport = result.points[0]!;

    expect(airport.funnel).toEqual({
      approaches: "1000.00000000",
      researches: "800.00000000",
      qualified: "400.00000000",
      invitations: "200.00000000",
      appointments: "100.00000000",
      shows: "80.00000000",
      tours: "60.00000000",
      sales: "12.00000000",
    });
    expect(airport.production).toEqual({
      totalSales: "12.00000000",
      incrementalSales: "9.00000000",
      cannibalizedSales: "3.00000000",
      healthyD90: "9.60000000",
      incrementalHealthyD90: "7.20000000",
    });
    expect(
      new Decimal(airport.production.incrementalSales)
        .plus(airport.production.cannibalizedSales)
        .toFixed(8),
    ).toBe(airport.production.totalSales);
  });

  it("rejeita taxas fora do intervalo de zero a um", () => {
    expect(() => calculatePointEconomics({
      points: [point({ saleRate: "1.00000001" })],
    })).toThrow("airport.saleRate deve estar entre 0 e 1");
  });

  it("rejeita ids de ponto duplicados", () => {
    expect(() => calculatePointEconomics({
      points: [point(), point({ name: "Aeroporto 2" })],
    })).toThrow("pointId duplicado: airport");
  });

  it("retorna null para indicadores sem denominador e nunca produz infinito ou NaN", () => {
    const result = calculatePointEconomics({
      points: [point({
        approaches: "0",
        activationCost: "0",
        monthlyFixedCost: "0",
        costPerSale: "0",
      })],
    }).points[0]!;

    expect(result.costs).toMatchObject({
      perApproach: null,
      perQualified: null,
      perShow: null,
      perTour: null,
      perSale: null,
      perHealthyD90: null,
    });
    expect(result.unitEconomics).toMatchObject({
      grossVpg: null,
      d90Vpg: null,
      averageEntry: null,
      contributionPerTour: null,
      contributionPerHealthyD90: null,
      monthlyRoi: null,
      paybackMonths: null,
    });
    expect(result.classification).toBe("KILL");
    expect(JSON.stringify(result)).not.toMatch(/Infinity|NaN/);
  });

  it("calcula custos unitários, VPG, contribuição, break-even, ROI e payback", () => {
    const result = calculatePointEconomics({ points: [point()] }).points[0]!;

    expect(result.costs).toMatchObject({
      monthlyVariable: "1200.00000000",
      monthlyOperating: "1700.00000000",
      perApproach: "1.70000000",
      perQualified: "4.25000000",
      perShow: "21.25000000",
      perTour: "28.33333333",
      perSale: "141.66666667",
      perHealthyD90: "177.08333333",
    });
    expect(result.unitEconomics).toEqual({
      grossVpg: "2000.00000000",
      d90Vpg: "1600.00000000",
      averageEntry: "2000.00000000",
      contributionPerTour: "600.00000000",
      contributionPerHealthyD90: "3000.00000000",
      breakEvenSales: "0.23255814",
      monthlyRoi: "14.88235294",
      paybackMonths: "0.03952569",
    });
  });

  it("classifica SCALE, OPTIMIZE e KILL com drivers explicáveis", () => {
    const result = calculatePointEconomics({
      points: [
        point(),
        point({ pointId: "hotel", name: "Hotel", activationCost: "400000" }),
        point({ pointId: "mall", name: "Shopping", monthlyFixedCost: "30000" }),
      ],
    });

    expect(result.points.map(item => item.classification)).toEqual([
      "SCALE",
      "OPTIMIZE",
      "KILL",
    ]);
    expect(result.points.every(item => item.drivers.length > 0)).toBe(true);
    expect(result.points[0]!.drivers.map(driver => driver.code)).toContain(
      "monthly_roi_scale",
    );
    expect(result.points[1]!.drivers.map(driver => driver.code)).toContain(
      "payback_optimize",
    );
    expect(result.points[2]!.drivers.map(driver => driver.code)).toContain(
      "incremental_contribution_non_positive",
    );
    expect(result.totals.classificationCounts).toEqual({
      SCALE: 1,
      OPTIMIZE: 1,
      KILL: 1,
    });
  });

  it("agrega pontos sem duplicar CAPEX e OPEX já incluídos nos totais do projeto", () => {
    const result = calculatePointEconomics({
      points: [
        point(),
        point({
          pointId: "hotel",
          name: "Hotel",
          activationCost: "2000",
          cashflowTreatment: "included_in_project_totals",
        }),
      ],
    });

    expect(result.totals.pointCount).toBe(2);
    expect(result.totals.production).toMatchObject({
      totalSales: "24.00000000",
      incrementalSales: "18.00000000",
      cannibalizedSales: "6.00000000",
      healthyD90: "19.20000000",
      incrementalHealthyD90: "14.40000000",
    });
    expect(result.totals.value).toMatchObject({
      grossSales: "240000.00000000",
      incrementalSales: "180000.00000000",
      cannibalizedSales: "60000.00000000",
    });
    expect(result.totals.cashflow).toEqual({
      totalActivationCost: "3000.00000000",
      totalMonthlyOperatingCost: "3400.00000000",
      incrementalCapex: "1000.00000000",
      incrementalMonthlyOpex: "1700.00000000",
    });
    expect(result.points[1]!.cashflow).toMatchObject({
      treatment: "included_in_project_totals",
      incrementalCapex: "0.00000000",
      incrementalMonthlyOpex: "0.00000000",
    });
  });

  it("reconcilia produção e valores monetários por ponto e no agregado", () => {
    const result = calculatePointEconomics({
      points: [point({
        approaches: "0.00000001",
        researchRate: "1",
        qualificationRate: "1",
        invitationRate: "1",
        appointmentRate: "1",
        showRate: "1",
        tourRate: "1",
        saleRate: "1",
        averageTicket: "1",
        activationCost: "0",
        monthlyFixedCost: "0",
        costPerSale: "0",
        cannibalizationRate: "0.5",
      })],
    });

    expect(result.points[0]!.reconciliation).toEqual({
      productionDifference: "0.00000000",
      salesValueDifference: "0.00000000",
    });
    expect(result.totals.reconciliation).toEqual({
      productionDifference: "0.00000000",
      salesValueDifference: "0.00000000",
    });
    expect(
      new Decimal(result.points[0]!.production.incrementalSales)
        .plus(result.points[0]!.production.cannibalizedSales)
        .toFixed(8),
    ).toBe(result.points[0]!.production.totalSales);
    expect(
      new Decimal(result.points[0]!.value.incrementalSales)
        .plus(result.points[0]!.value.cannibalizedSales)
        .toFixed(8),
    ).toBe(result.points[0]!.value.grossSales);
  });

  it("rejeita valores monetários e volumes negativos", () => {
    expect(() => calculatePointEconomics({
      points: [point({ activationCost: "-0.01" })],
    })).toThrow("airport.activationCost deve ser decimal não negativo");
    expect(() => calculatePointEconomics({
      points: [point({ approaches: "-1" })],
    })).toThrow("airport.approaches deve ser decimal não negativo");
  });
});
