import { FinanceDecimal } from "./engine";

export type CostCashflowTreatment = "incremental" | "included_in_project_totals";
export type CostCatalogInput = { category: string; frequency: "monthly" | "annual" | "one_time"; amountText: string | null; status: "provided" | "pending"; cashflowTreatment?: CostCashflowTreatment };
export type CostCatalogSummary = { status: "valid"; monthlyRunRate: string; annualRunRate: string; oneTimeCosts: string; byCategory: Record<string, string> } | { status: "blocked"; pendingCount: number };
export type CostCatalogCashflowAdjustments = { status: "valid"; fixedCostMonthly: string; payrollMonthly: string; capexInitial: string } | { status: "blocked"; pendingCount: number } | { status: "invalid"; invalidCount: number };
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

/** Only explicitly incremental rows feed cash; legacy/informational rows cannot double-count aggregate project inputs. */
export function deriveCostCatalogCashflowAdjustments(items: CostCatalogInput[]): CostCatalogCashflowAdjustments {
  const incrementalItems = items.filter(item => item.cashflowTreatment === "incremental");
  const pendingCount = incrementalItems.filter(item => item.status !== "provided" || !item.amountText).length;
  if (pendingCount) return { status: "blocked", pendingCount };
  const zero = new FinanceDecimal(0); let fixedCostMonthly = zero; let payrollMonthly = zero; let capexInitial = zero; let invalidCount = 0;
  for (const item of incrementalItems) {
    let amount: FinanceDecimalInstance;
    try { amount = new FinanceDecimal(item.amountText!); } catch { invalidCount += 1; continue; }
    if (!amount.isFinite() || amount.lt(zero)) { invalidCount += 1; continue; }
    if (item.frequency === "one_time") { capexInitial = capexInitial.plus(amount); continue; }
    const monthlyAmount = item.frequency === "annual" ? amount.div(12) : amount;
    if (item.category === "payroll") payrollMonthly = payrollMonthly.plus(monthlyAmount);
    else fixedCostMonthly = fixedCostMonthly.plus(monthlyAmount);
  }
  if (invalidCount) return { status: "invalid", invalidCount };
  return { status: "valid", fixedCostMonthly: fixedCostMonthly.toFixed(8), payrollMonthly: payrollMonthly.toFixed(8), capexInitial: capexInitial.toFixed(8) };
}
