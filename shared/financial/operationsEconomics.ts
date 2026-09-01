import { FinanceDecimal } from "./engine";

type ComponentPayload = Record<string, unknown>;
type EconomicsResult = { status: "valid"; metrics: Record<string, string> } | { status: "blocked"; missingKeys: string[] };
type FinanceDecimalInstance = InstanceType<typeof FinanceDecimal>;

function decimal(payload: ComponentPayload, key: string): FinanceDecimalInstance | null {
  const value = payload[key];
  if (value === undefined || value === null || value === "" || value === "PENDENTE") return null;
  try { return new FinanceDecimal(String(value)); } catch { return null; }
}

function required(payload: ComponentPayload, keys: string[]) {
  return keys.filter((key) => decimal(payload, key) === null);
}

function text(value: FinanceDecimalInstance) { return value.toFixed(8); }

export function calculateWorkforceEconomics(payload: ComponentPayload): EconomicsResult {
  const keys = ["headcountPlanejado", "custoFteMensal", "rampUpMeses", "turnoverAnual", "produtividadePorFte", "custoMovimentacao", "encargosPercentual"];
  const missingKeys = required(payload, keys);
  if (missingKeys.length) return { status: "blocked", missingKeys };
  const headcount = decimal(payload, "headcountPlanejado")!;
  const monthlyComp = decimal(payload, "custoFteMensal")!;
  const rampUpMonths = decimal(payload, "rampUpMeses")!;
  const turnover = decimal(payload, "turnoverAnual")!;
  const productivity = decimal(payload, "produtividadePorFte")!;
  const movementCost = decimal(payload, "custoMovimentacao")!;
  const burden = decimal(payload, "encargosPercentual")!;
  const one = new FinanceDecimal(1);
  const annualComp = headcount.times(monthlyComp).times(one.plus(burden)).times(12);
  const monthlyAttrition = headcount.times(turnover).div(12);
  const annualMovementCost = monthlyAttrition.times(movementCost).times(12);
  const rampFactorMonthOne = rampUpMonths.gt(0) ? one.div(rampUpMonths) : one;
  return { status: "valid", metrics: {
    annualFullyLoadedCost: text(annualComp), monthlyAttritionFte: text(monthlyAttrition), annualMovementCost: text(annualMovementCost),
    rampUpMonthOneCost: text(annualComp.div(12).times(rampFactorMonthOne)), annualProductivityCapacity: text(headcount.times(productivity)),
  } };
}

export function calculateCommercialCapacity(payload: ComponentPayload): EconomicsResult {
  const keys = ["casaisQualificados", "casaisCanalDireto", "casaisCanalParceiro", "capacidadeSala", "recepcionistas", "casaisPorRecepcionista", "consultores", "closers", "diasVendaMes", "sessoesPorDia", "casaisPorConsultor", "conversaoEsperada", "fatorSazonal"];
  const missingKeys = required(payload, keys);
  if (missingKeys.length) return { status: "blocked", missingKeys };
  const couples = decimal(payload, "casaisQualificados")!;
  const directChannelCouples = decimal(payload, "casaisCanalDireto")!;
  const partnerChannelCouples = decimal(payload, "casaisCanalParceiro")!;
  const roomSeats = decimal(payload, "capacidadeSala")!;
  const receptionists = decimal(payload, "recepcionistas")!;
  const couplesPerReceptionist = decimal(payload, "casaisPorRecepcionista")!;
  const consultants = decimal(payload, "consultores")!;
  const closers = decimal(payload, "closers")!;
  const sellingDays = decimal(payload, "diasVendaMes")!;
  const sessions = decimal(payload, "sessoesPorDia")!;
  const couplesPerConsultant = decimal(payload, "casaisPorConsultor")!;
  const conversion = decimal(payload, "conversaoEsperada")!;
  const seasonalityFactor = decimal(payload, "fatorSazonal")!;
  const channelQualifiedCouples = directChannelCouples.plus(partnerChannelCouples);
  const seasonallyAdjustedCouples = FinanceDecimal.min(couples, channelQualifiedCouples).times(seasonalityFactor);
  const roomMonthlyCapacity = roomSeats.times(sessions).times(sellingDays);
  const receptionMonthlyCapacity = receptionists.times(couplesPerReceptionist);
  const consultantMonthlyCapacity = consultants.times(couplesPerConsultant);
  const workableCouples = FinanceDecimal.min(seasonallyAdjustedCouples, roomMonthlyCapacity, receptionMonthlyCapacity, consultantMonthlyCapacity);
  const projectedSales = workableCouples.times(conversion);
  const salesPerCloser = closers.gt(0) ? projectedSales.div(closers) : new FinanceDecimal(0);
  return { status: "valid", metrics: {
    channelQualifiedCouples: text(channelQualifiedCouples), seasonallyAdjustedCouples: text(seasonallyAdjustedCouples), roomMonthlyCapacity: text(roomMonthlyCapacity), receptionMonthlyCapacity: text(receptionMonthlyCapacity), consultantMonthlyCapacity: text(consultantMonthlyCapacity), workableQualifiedCouples: text(workableCouples),
    projectedMonthlySales: text(projectedSales), projectedSalesPerCloser: text(salesPerCloser),
  } };
}
