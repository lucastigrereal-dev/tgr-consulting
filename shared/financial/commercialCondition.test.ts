import { describe, expect, it } from "vitest";
import { reconcileCommercialCondition } from "./commercialCondition";

describe("reconcileCommercialCondition", () => {
  it("reconcilia preço líquido com entrada, saldo e encargos explícitos", () => {
    const result = reconcileCommercialCondition({
      id: "standard",
      name: "Condição padrão",
      listPrice: "100000",
      discount: "5000",
      entry: { total: "15000", installments: 3, firstDueMonth: 1 },
      balance: {
        principal: "80000",
        installments: 40,
        graceMonths: 2,
        firstDueMonth: 4,
      },
      explicitCharges: "0",
      correctionRate: "0",
      interestRate: "0",
      materialityTolerance: "0.01",
      campaign: "Lançamento",
    });

    expect(result).toMatchObject({
      status: "valid",
      expectedPrice: "95000.00000000",
      financialComponents: "95000.00000000",
      difference: "0.00000000",
      entryInstallmentValue: "5000.00000000",
      balanceInstallmentValue: "2000.00000000",
      blocksOfficialSnapshot: false,
      violations: [],
    });
  });

  it("bloqueia snapshot quando a diferença comercial é material", () => {
    const result = reconcileCommercialCondition({
      id: "broken",
      name: "Condição inconsistente",
      listPrice: "100000",
      discount: "0",
      entry: { total: "10000", installments: 2, firstDueMonth: 1 },
      balance: {
        principal: "80000",
        installments: 40,
        graceMonths: 2,
        firstDueMonth: 4,
      },
      explicitCharges: "0",
      materialityTolerance: "1",
    });

    expect(result.status).toBe("invalid");
    expect(result.difference).toBe("10000.00000000");
    expect(result.blocksOfficialSnapshot).toBe(true);
    expect(result.violations).toContainEqual({
      code: "COMMERCIAL_CONDITION_MISMATCH",
      path: "difference",
      message: "O preço líquido não reconcilia com os componentes financeiros.",
    });
  });
});
