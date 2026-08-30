import { FinanceDecimal } from "./engine";

export type CostCatalogInput = { category: string; frequency: "monthly" | "annual" | "one_time"; amountText: string | null; status: "provided" | "pending" };
export type CostCatalogSummary = { status: "valid"; monthlyRunRate: string; annualRunRate: string; oneTimeCosts: string; byCategory: Record<string, string> } | { status: "blocked"; pendingCount: number };
type FinanceDecimalInstance = InstanceType<typeof FinanceDecimal>;

export function summarizeCostCatalog(items: CostCatalogInput[]): CostCatalogSummary {
  const pendingCount = items.filter((item) => item.status !== "provided" || !item.amountText).length;
  if (pendingCount) return { status: "blocked", pendingCount };
  const zero = new FinanceDecimal(0); let monthly = zero; let annual = zero; let oneTime = zero; const byCategory: Record<string, FinanceDecimalInstance> = {};
  for (const item of items) {
    const amount = new FinanceDecimal(item.amountText!);
    const annualized = item.frequency === "monthly" ? amount.times(12) : item.frequency === "annual" ? amount : zero;
    monthly = monthly.plus(item.frequency === "monthly" ? amount : item.frequency === "annual" ? amount.div(12) : zero);
    annual = annual.plus(annualized); oneTime = oneTime.plus(item.frequency === "one_time" ? amount : zero);
    byCategory[item.category] = (byCategory[item.category] ?? zero).plus(annualized);
  }
  return { status: "valid", monthlyRunRate: monthly.toFixed(8), annualRunRate: annual.toFixed(8), oneTimeCosts: oneTime.toFixed(8), byCategory: Object.fromEntries(Object.entries(byCategory).map(([key, value]) => [key, value.toFixed(8)])) };
}
