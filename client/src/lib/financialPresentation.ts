export function normalizeDecimalInput(value: string) {
  const cleaned = value.replace(/[^0-9,.-]/g, "").replace(",", ".");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;
}

export function isDecimal(value: string) {
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value);
}

export function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(numeric);
}

export function formatPercent(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 }).format(numeric);
}

export function formatKpi(key: string, value: string | number | null | undefined) {
  if (["npv", "totalOperatingCashFlow", "grossSales", "averageTicket", "grossEntryGenerated", "grossEntrySettled", "grossReceivablesGenerated", "grossReceivablesSettled", "installmentCollections", "canceledReceivables", "delinquentBalance", "curedCollections", "writtenOffBalance", "paymentFees", "netCollections", "preOperationalInvestment"].includes(key)) return formatCurrency(value);
  if (key === "irrAnnual" || key.endsWith("Rate")) return formatPercent(value);
  if (key === "paybackMonths") return value === null || value === undefined ? "—" : `${Math.round(Number(value))} meses`;
  return value === null || value === undefined || value === "" ? "—" : String(value);
}
