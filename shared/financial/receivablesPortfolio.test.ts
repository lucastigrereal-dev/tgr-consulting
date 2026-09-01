import { describe, expect, it } from "vitest";
import { FinanceDecimal } from "./engine";
import {
  buildReceivablesPortfolio,
  type ReceivablesPolicy,
} from "./receivablesPortfolio";

const policy = (overrides: Partial<ReceivablesPolicy> = {}): ReceivablesPolicy => ({
  cancellationCurve: {
    d7: "0.05000000",
    d30: "0.10000000",
    d60: "0.12000000",
    d90: "0.15000000",
    d180: "0.18000000",
    lifetime: "0.20000000",
  },
  delinquencyRate: "0.20000000",
  cureRates: {
    days1To30: "0.50000000",
    days31To60: "0.50000000",
    days61To90: "0.50000000",
    days90Plus: "0.50000000",
  },
  writeOffAfterDays: 120,
  policyVersion: "portfolio-v1",
  sourceRef: "board-approved-policy-2026-08",
  ...overrides,
});

const cohort = (paymentSchedulePerContract = [
  { component: "entry" as const, dueMonthOffset: 0, grossAmount: "100.00000000" },
]) => ({
  cohortId: "cohort-jan",
  saleMonth: 0,
  contracts: "10.00000000",
  paymentSchedulePerContract,
});

const amount = (value: string) => new FinanceDecimal(value);

describe("buildReceivablesPortfolio", () => {
  it("rejeita curva de cancelamento cumulativa não monotônica", () => {
    expect(() => buildReceivablesPortfolio({
      cohorts: [cohort()],
      policy: policy({
        cancellationCurve: {
          d7: "0.10000000",
          d30: "0.09000000",
          d60: "0.12000000",
          d90: "0.15000000",
          d180: "0.18000000",
          lifetime: "0.20000000",
        },
      }),
      asOfMonth: 4,
    })).toThrow("monotônica");
  });

  it("mantém cancelamento separado da inadimplência e aplica D7 aos vencimentos posteriores", () => {
    const result = buildReceivablesPortfolio({
      cohorts: [cohort([
        { component: "entry", dueMonthOffset: 0, grossAmount: "100.00000000" },
        { component: "balance", dueMonthOffset: 1, grossAmount: "100.00000000" },
      ])],
      policy: policy({
        delinquencyRate: "0.20000000",
        cureRates: {
          days1To30: "0",
          days31To60: "0",
          days61To90: "0",
          days90Plus: "0",
        },
      }),
      asOfMonth: 2,
    });

    const immediate = result.ledger[0]!;
    const later = result.ledger[1]!;
    expect(immediate.canceledBeforeDue).toBe("0.00000000");
    expect(immediate.expectedAfterCancellation).toBe("1000.00000000");
    expect(immediate.currentCollected).toBe("800.00000000");
    expect(immediate.openDelinquent).toBe("200.00000000");
    expect(later.canceledBeforeDue).toBe("100.00000000");
    expect(later.expectedAfterCancellation).toBe("900.00000000");
    expect(later.currentCollected).toBe("720.00000000");
    expect(later.openDelinquent).toBe("180.00000000");
  });

  it("realiza curas condicionais nos meses dos respectivos buckets", () => {
    const result = buildReceivablesPortfolio({
      cohorts: [cohort()],
      policy: policy({
        cancellationCurve: {
          d7: "0", d30: "0", d60: "0", d90: "0", d180: "0", lifetime: "0",
        },
        delinquencyRate: "1",
        cureRates: {
          days1To30: "0.5",
          days31To60: "0.5",
          days61To90: "0.5",
          days90Plus: "0.5",
        },
      }),
      asOfMonth: 3,
    });

    expect(result.ledger[0]!.curedCollections).toEqual([
      { bucket: "1_30", collectionMonth: 1, amount: "500.00000000" },
      { bucket: "31_60", collectionMonth: 2, amount: "250.00000000" },
      { bucket: "61_90", collectionMonth: 3, amount: "125.00000000" },
    ]);
    expect(result.ledger[0]!.openDelinquent).toBe("125.00000000");
    expect(result.monthlySummaries.map(summary => summary.curedCollections)).toEqual([
      "0.00000000",
      "500.00000000",
      "250.00000000",
      "125.00000000",
    ]);
  });

  it("faz write-off do remanescente após as curas permitidas pela janela", () => {
    const result = buildReceivablesPortfolio({
      cohorts: [cohort()],
      policy: policy({
        cancellationCurve: {
          d7: "0", d30: "0", d60: "0", d90: "0", d180: "0", lifetime: "0",
        },
        delinquencyRate: "1",
        cureRates: {
          days1To30: "0.5",
          days31To60: "0",
          days61To90: "0",
          days90Plus: "1",
        },
        writeOffAfterDays: 90,
      }),
      asOfMonth: 3,
    });

    expect(result.ledger[0]!.writtenOff).toBe("500.00000000");
    expect(result.ledger[0]!.openDelinquent).toBe("0.00000000");
    expect(result.ledger[0]!.agingStatus).toBe("written_off");
    expect(result.monthlySummaries[3]!.writtenOff).toBe("500.00000000");
  });

  it("calcula contratos ativos e saudáveis esperados em D90", () => {
    const result = buildReceivablesPortfolio({
      cohorts: [cohort([
        { component: "entry", dueMonthOffset: 0, grossAmount: "90.00000000" },
        { component: "explicit_charge", dueMonthOffset: 0, grossAmount: "10.00000000" },
      ])],
      policy: policy({
        delinquencyRate: "0.2",
        cureRates: {
          days1To30: "0.5",
          days31To60: "0.5",
          days61To90: "0.5",
          days90Plus: "0",
        },
      }),
      asOfMonth: 4,
    });

    expect(result.cohortSummaries[0]).toMatchObject({
      cohortId: "cohort-jan",
      activeD90: "8.50000000",
      healthyD90: "8.28750000",
    });
    expect(result.canceledContractsByMilestone).toEqual([
      { cohortId: "cohort-jan", milestone: "d7", month: 1, contracts: "0.50000000" },
      { cohortId: "cohort-jan", milestone: "d30", month: 1, contracts: "0.50000000" },
      { cohortId: "cohort-jan", milestone: "d60", month: 2, contracts: "0.20000000" },
      { cohortId: "cohort-jan", milestone: "d90", month: 3, contracts: "0.30000000" },
      { cohortId: "cohort-jan", milestone: "d180", month: 6, contracts: "0.30000000" },
      { cohortId: "cohort-jan", milestone: "lifetime", month: 7, contracts: "0.20000000" },
    ]);
  });

  it("conserva dinheiro em cada recebível no mês observado", () => {
    const result = buildReceivablesPortfolio({
      cohorts: [cohort([
        { component: "entry", dueMonthOffset: 0, grossAmount: "33.33333333" },
        { component: "balance", dueMonthOffset: 2, grossAmount: "66.66666667" },
      ])],
      policy: policy(),
      asOfMonth: 4,
    });

    for (const receivable of result.ledger) {
      const cured = receivable.curedCollections.reduce(
        (total, collection) => total.plus(collection.amount),
        new FinanceDecimal(0),
      );
      expect(
        amount(receivable.currentCollected)
          .plus(cured)
          .plus(receivable.writtenOff)
          .plus(receivable.openDelinquent)
          .toFixed(8),
      ).toBe(receivable.expectedAfterCancellation);
    }
  });

  it("mantém os resumos mensais equivalentes à agregação de referência do ledger", () => {
    const result = buildReceivablesPortfolio({
      cohorts: [
        cohort([
          { component: "entry", dueMonthOffset: 0, grossAmount: "100.00000000" },
          { component: "balance", dueMonthOffset: 2, grossAmount: "300.00000000" },
        ]),
        {
          ...cohort([
            { component: "entry", dueMonthOffset: 1, grossAmount: "75.00000000" },
            { component: "balance", dueMonthOffset: 3, grossAmount: "225.00000000" },
          ]),
          cohortId: "cohort-fev",
          saleMonth: 1,
          contracts: "7.50000000",
        },
      ],
      policy: policy(),
      asOfMonth: 8,
    });

    const sum = (values: string[]) => values
      .reduce((total, value) => total.plus(value), new FinanceDecimal(0))
      .toFixed(8);
    const reference = result.monthlySummaries.map(summary => {
      const due = result.ledger.filter(line => line.dueMonth === summary.month);
      const cures = result.ledger.flatMap(line => line.curedCollections)
        .filter(collection => collection.collectionMonth === summary.month);
      const writeOffs = result.ledger.filter(
        line => line.writtenOffMonth === summary.month,
      );
      const open = result.ledger
        .filter(line => line.dueMonth <= summary.month)
        .map(line => {
          let value = new FinanceDecimal(line.expectedAfterCancellation)
            .minus(line.currentCollected);
          for (const cure of line.curedCollections) {
            if (cure.collectionMonth <= summary.month) value = value.minus(cure.amount);
          }
          if (
            line.writtenOffMonth !== null &&
            line.writtenOffMonth <= summary.month
          ) return "0";
          return value.toString();
        });

      return {
        month: summary.month,
        grossDue: sum(due.map(line => line.gross)),
        canceledBeforeDue: sum(due.map(line => line.canceledBeforeDue)),
        expectedAfterCancellation: sum(due.map(line => line.expectedAfterCancellation)),
        currentCollected: sum(due.map(line => line.currentCollected)),
        curedCollections: sum(cures.map(collection => collection.amount)),
        writtenOff: sum(writeOffs.map(line => line.writtenOff)),
        openDelinquent: sum(open),
      };
    });

    expect(result.monthlySummaries).toEqual(reference);
  });
});
