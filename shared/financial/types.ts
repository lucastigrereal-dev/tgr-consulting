import type { ReceivablesPortfolio } from "./receivablesPortfolio";
import type { PointEconomicsPortfolio } from "./pointEconomics";
import type {
  CommissionLedger,
  CommercialOperationsResult,
} from "./commercialOperations";

export const FINANCIAL_INPUT_KEYS = [
  "qualifiedCouplesMonth1",
  "qualifiedCouplesGrowthRate",
  "conversionRate",
  "averageTicket",
  "collectionRate",
  "cancellationRate",
  "variableCostRate",
  "partnerShareRate",
  "fixedCostMonthly",
  "payrollMonthly",
  "capexInitial",
  "capexAcquisitionShareRate",
  "capexAcquisitionMonth",
  "capexSalesRoomShareRate",
  "capexSalesRoomMonth",
  "capexSalesKitShareRate",
  "capexSalesKitMonth",
  "preOperationMonths",
  "entryValuePerContract",
  "paymentCardViewMixRate",
  "paymentCardViewMdrRate",
  "paymentCardViewSettlementDays",
  "paymentCardInstallmentMixRate",
  "paymentCardInstallmentMdrRate",
  "paymentCardInstallmentSettlementDays",
  "paymentDebitMixRate",
  "paymentDebitMdrRate",
  "paymentDebitSettlementDays",
  "paymentRecurringChequeMixRate",
  "paymentRecurringChequeMdrRate",
  "paymentRecurringChequeSettlementDays",
  "paymentBoletoMixRate",
  "paymentBoletoMdrRate",
  "paymentBoletoSettlementDays",
  "discountRateAnnual",
] as const;

export type FinancialInputKey = (typeof FINANCIAL_INPUT_KEYS)[number];
export const OPTIONAL_FINANCIAL_INPUT_KEYS = [
  "capexAcquisitionShareRate",
  "capexAcquisitionMonth",
  "capexSalesRoomShareRate",
  "capexSalesRoomMonth",
  "capexSalesKitShareRate",
  "capexSalesKitMonth",
] as const satisfies readonly FinancialInputKey[];
export type OptionalFinancialInputKey = (typeof OPTIONAL_FINANCIAL_INPUT_KEYS)[number];
export type DecimalText = string;
export type InputStatus = "provided" | "pending";
export type SourceType =
  | "current_decision"
  | "current_document"
  | "historical_primary"
  | "derived_analysis"
  | "external_benchmark"
  | "assumption";

export type FinancialInput = {
  status: InputStatus;
  value?: DecimalText;
  sourceType: SourceType;
  sourceRef?: string;
  updatedBy?: string;
};

export type FinancialInputSnapshot = Record<FinancialInputKey, FinancialInput>;

export type FormulaDefinition = {
  id: string;
  name: string;
  version: string;
  expression: string;
  dependencies: FinancialInputKey[] | string[];
  description: string;
};

export type FormulaSetVersion = {
  id: string;
  semanticVersion: string;
  engineVersion: string;
  status: "draft" | "published" | "retired";
  definitions: FormulaDefinition[];
};

export type CalculationMemory = {
  kpiKey: string;
  label: string;
  value: DecimalText | null;
  formulaId: string;
  formulaVersion: string;
  expression: string;
  dependencies: string[];
  explanation: string;
};

export type MonthlyProjection = {
  month: number;
  qualifiedCouples: DecimalText;
  /** Campo legado equivalente a grossContracts. */
  contracts: DecimalText;
  grossContracts: DecimalText;
  canceledContracts: DecimalText;
  netContracts: DecimalText;
  cumulativeGrossContracts: DecimalText;
  activeContracts: DecimalText;
  returnedToInventory: DecimalText;
  /** Indisponível quando maxContracts não foi configurado. */
  availableInventory: DecimalText | null;
  /** Relação activeContracts / maxContracts; indisponível sem estoque físico. */
  sellOutRate: DecimalText | null;
  grossSales: DecimalText;
  recognizedRevenue: DecimalText;
  variableCosts: DecimalText;
  partnerShare: DecimalText;
  /** Impostos ainda não configurados no motor; permanece explicitamente zero. */
  taxes: DecimalText;
  fixedCosts: DecimalText;
  commercialOperationsCosts: DecimalText;
  commissionPayments: DecimalText;
  payroll: DecimalText;
  capex: DecimalText;
  preOperationalInvestment: DecimalText;
  grossEntryGenerated: DecimalText;
  grossEntrySettled: DecimalText;
  grossReceivablesGenerated: DecimalText;
  grossReceivablesSettled: DecimalText;
  installmentCollections: DecimalText;
  canceledReceivables: DecimalText;
  delinquentBalance: DecimalText;
  curedCollections: DecimalText;
  writtenOffBalance: DecimalText;
  healthyD90: DecimalText;
  paymentFees: DecimalText;
  netCollections: DecimalText;
  cashOpening: DecimalText;
  cashInflows: DecimalText;
  cashOutflows: DecimalText;
  contributionMargin: DecimalText;
  operatingResult: DecimalText;
  cashClosing: DecimalText;
  operatingCashFlow: DecimalText;
  cumulativeCashFlow: DecimalText;
  discountedCashFlow: DecimalText;
};

export type CalculationStatus = "valid" | "blocked_by_pending_inputs" | "invalid";

export type FinancialCalculation = {
  status: CalculationStatus;
  horizonMonths: number;
  missingInputKeys: FinancialInputKey[];
  formulaSetVersion: string;
  engineVersion: string;
  projections: MonthlyProjection[];
  kpis: {
    grossSales: DecimalText | null;
    grossEntryGenerated: DecimalText | null;
    grossReceivablesGenerated: DecimalText | null;
    grossReceivablesSettled: DecimalText | null;
    installmentCollections: DecimalText | null;
    canceledReceivables: DecimalText | null;
    delinquentBalance: DecimalText | null;
    curedCollections: DecimalText | null;
    writtenOffBalance: DecimalText | null;
    healthyD90: DecimalText | null;
    recognizedRevenue: DecimalText | null;
    paymentFees: DecimalText | null;
    preOperationalInvestment: DecimalText | null;
    totalOperatingCashFlow: DecimalText | null;
    totalGrossContracts: DecimalText | null;
    totalNetContracts: DecimalText | null;
    sellOutMonth: DecimalText | null;
    contributionMargin: DecimalText | null;
    operatingMarginRate: DecimalText | null;
    capitalRequired: DecimalText | null;
    worstCashMonth: DecimalText | null;
    breakEvenMonth: DecimalText | null;
    npv: DecimalText | null;
    irrAnnual: DecimalText | null;
    paybackMonths: DecimalText | null;
  };
  memory: CalculationMemory[];
  receivablesPortfolio?: ReceivablesPortfolio;
  pointEconomics?: PointEconomicsPortfolio;
  commercialOperations?: CommercialOperationsResult;
  commissionLedger?: CommissionLedger;
};

export type ProjectLifecycleState = "draft" | "in_review" | "approved" | "baseline";

export type ProjectVersionGuard = {
  id: string;
  projectId: string;
  state: ProjectLifecycleState;
  isImmutable: boolean;
  parentVersionId?: string;
};

export type GoalSeekResult = {
  status:
    | "converged"
    | "unreachable"
    | "iteration_limit"
    | "unsupported"
    | "infeasible";
  targetKpi?: string;
  variableKey: string;
  target: DecimalText;
  result: DecimalText | null;
  objectiveValue: DecimalText | null;
  residual: DecimalText | null;
  lowerBound: DecimalText;
  upperBound: DecimalText;
  iterations: number;
  reason?: string;
};

export type CapitalEnvelopeResult = {
  availableCapital: DecimalText;
  requiredCapital: DecimalText;
  headroom: DecimalText;
  minimumCumulativeCashFlow: DecimalText;
  limitingMonth: number | null;
};
