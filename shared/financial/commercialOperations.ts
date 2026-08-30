import Decimal from "decimal.js";

const OperationsDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});
type D = InstanceType<typeof OperationsDecimal>;
const ZERO = new OperationsDecimal(0);
const ONE = new OperationsDecimal(1);

const text = (value: D) => (value.eq(ZERO) ? ZERO : value).toFixed(8);
const sum = (values: readonly D[]) => values.reduce(
  (total, value) => total.plus(value),
  new OperationsDecimal(0),
);

function decimal(value: string, field: string): D {
  let parsed: D;
  try {
    parsed = new OperationsDecimal(value);
  } catch {
    throw new Error(`${field} deve ser decimal válido.`);
  }
  if (!parsed.isFinite() || parsed.lt(ZERO)) {
    throw new Error(`${field} deve ser decimal não negativo.`);
  }
  return parsed;
}

function rate(value: string, field: string): D {
  const parsed = decimal(value, field);
  if (parsed.gt(ONE)) throw new Error(`${field} deve estar entre 0 e 1.`);
  return parsed;
}

function count(value: string, field: string): D {
  const parsed = decimal(value, field);
  if (!parsed.isInteger()) throw new Error(`${field} deve ser inteiro.`);
  return parsed;
}

function integer(value: number, field: string, minimum = 0): void {
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${field} deve ser inteiro maior ou igual a ${minimum}.`);
  }
}

function required(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} é obrigatório.`);
}

function divide(numerator: D, denominator: D): D | null {
  return denominator.eq(ZERO) ? null : numerator.div(denominator);
}

function minimum(entries: Array<{ key: string; value: D }>) {
  return entries.reduce((current, entry) =>
    entry.value.lt(current.value) ? entry : current,
  );
}

export type RoomCapacityInput = {
  rooms: Array<{ roomId: string; tables: string; overflowTables: string }>;
  operatingDaysPerMonth: string;
  operatingHoursPerDay: string;
  shifts: string;
  averageTourDurationMinutes: string;
  toursPerTable: string;
  receptionists: string;
  receptionCapacityPerPerson: string;
  consultants: string;
  consultantCapacityPerPerson: string;
  closers: string;
  closerSalesCapacityPerPerson: string;
  saleRate: string;
  peakFlowFactor: string;
  maxWaitMinutes: string;
  plannedToursMonthly: string;
  plannedSalesMonthly: string;
};

export type RoomCapacityAlert = {
  code: string;
  severity: "warning" | "critical";
  message: string;
  demand: string;
  capacity: string;
};

export function calculateRoomCapacity(input: RoomCapacityInput) {
  if (input.rooms.length === 0) throw new Error("rooms deve conter ao menos uma sala.");
  const ids = new Set<string>();
  const tables = sum(input.rooms.map((room, index) => {
    required(room.roomId, `rooms.${index}.roomId`);
    if (ids.has(room.roomId)) throw new Error(`roomId duplicado: ${room.roomId}.`);
    ids.add(room.roomId);
    return count(room.tables, `${room.roomId}.tables`)
      .plus(count(room.overflowTables, `${room.roomId}.overflowTables`));
  }));
  const days = count(input.operatingDaysPerMonth, "operatingDaysPerMonth");
  const hours = decimal(input.operatingHoursPerDay, "operatingHoursPerDay");
  const shifts = count(input.shifts, "shifts");
  const duration = decimal(input.averageTourDurationMinutes, "averageTourDurationMinutes");
  const toursPerTable = decimal(input.toursPerTable, "toursPerTable");
  if (duration.eq(ZERO)) throw new Error("averageTourDurationMinutes deve ser maior que zero.");
  if (shifts.eq(ZERO)) throw new Error("shifts deve ser maior que zero.");

  const receptionists = count(input.receptionists, "receptionists");
  const receptionPerPerson = decimal(input.receptionCapacityPerPerson, "receptionCapacityPerPerson");
  const consultants = count(input.consultants, "consultants");
  const consultantPerPerson = decimal(input.consultantCapacityPerPerson, "consultantCapacityPerPerson");
  const closers = count(input.closers, "closers");
  const closerPerPerson = decimal(input.closerSalesCapacityPerPerson, "closerSalesCapacityPerPerson");
  const saleRate = rate(input.saleRate, "saleRate");
  const peakFactor = decimal(input.peakFlowFactor, "peakFlowFactor");
  const maxWait = decimal(input.maxWaitMinutes, "maxWaitMinutes");
  const plannedTours = decimal(input.plannedToursMonthly, "plannedToursMonthly");
  const plannedSales = decimal(input.plannedSalesMonthly, "plannedSalesMonthly");

  const toursPerTableHour = new OperationsDecimal(60).div(duration).times(toursPerTable);
  const physicalMonthly = tables.times(days).times(hours).times(toursPerTableHour);
  const physicalPeakHourly = tables.times(toursPerTableHour);
  const physicalPerShift = physicalMonthly.div(shifts);
  const receptionMonthly = receptionists.times(receptionPerPerson);
  const consultantMonthly = consultants.times(consultantPerPerson);
  const limitedTours = minimum([
    { key: "physical", value: physicalMonthly },
    { key: "reception", value: receptionMonthly },
    { key: "consultants", value: consultantMonthly },
  ]);
  const closerSales = closers.times(closerPerPerson);
  const tourDrivenSales = limitedTours.value.times(saleRate);
  const limitedSales = minimum([
    { key: "tour_capacity", value: tourDrivenSales },
    { key: "closers", value: closerSales },
  ]);
  const operatingHoursMonthly = days.times(hours);
  const averageHourlyDemand = divide(plannedTours, operatingHoursMonthly);
  const peakHourlyDemand = averageHourlyDemand?.times(peakFactor) ?? ZERO;
  const overloadRatio = divide(peakHourlyDemand, physicalPeakHourly);
  const estimatedWait = overloadRatio === null
    ? null
    : OperationsDecimal.max(ZERO, overloadRatio.minus(ONE).times(duration));

  const alerts: RoomCapacityAlert[] = [];
  const addCapacityAlert = (
    code: string,
    message: string,
    demand: D,
    capacity: D,
  ) => {
    if (demand.gt(capacity)) alerts.push({
      code,
      severity: "critical",
      message,
      demand: text(demand),
      capacity: text(capacity),
    });
  };
  addCapacityAlert("tour_capacity_exceeded", "Tours planejados excedem a capacidade limitada.", plannedTours, limitedTours.value);
  addCapacityAlert("reception_capacity_exceeded", "Tours planejados excedem a capacidade da recepção.", plannedTours, receptionMonthly);
  addCapacityAlert("consultant_capacity_exceeded", "Tours planejados excedem a capacidade dos consultores.", plannedTours, consultantMonthly);
  addCapacityAlert("closer_capacity_exceeded", "Vendas planejadas excedem a capacidade dos closers.", plannedSales, closerSales);
  if (estimatedWait === null || estimatedWait.gt(maxWait)) alerts.push({
    code: "peak_queue_exceeded",
    severity: "critical",
    message: "A espera estimada no pico excede o limite operacional.",
    demand: estimatedWait === null ? text(peakHourlyDemand) : text(estimatedWait),
    capacity: estimatedWait === null ? text(physicalPeakHourly) : text(maxWait),
  });

  return {
    capacity: {
      tables: text(tables),
      physicalToursMonthly: text(physicalMonthly),
      physicalToursPerShift: text(physicalPerShift),
      physicalToursPeakHourly: text(physicalPeakHourly),
      receptionToursMonthly: text(receptionMonthly),
      consultantToursMonthly: text(consultantMonthly),
      limitedToursMonthly: text(limitedTours.value),
      closerSalesMonthly: text(closerSales),
      limitedSalesMonthly: text(limitedSales.value),
    },
    bottlenecks: { tours: limitedTours.key, sales: limitedSales.key },
    queue: {
      plannedPeakToursHourly: text(peakHourlyDemand),
      estimatedPeakWaitMinutes: estimatedWait === null ? null : text(estimatedWait),
      maxWaitMinutes: text(maxWait),
    },
    alerts,
  };
}

export type WorkforceCohortInput = {
  cohortId: string;
  role: string;
  headcount: string;
  hireMonth: number;
  trainingMonths: number;
  certificationRate: string;
  rampCurve: Array<{ productiveAgeMonth: number; productivityRate: string }>;
  matureProductivity: string;
  absenteeismRate: string;
  monthlyTurnoverRate: string;
  fixedCompensation: string;
  burden: string;
  guarantee: string;
  allowance: string;
  replacementCost: string;
};

type WorkforceBucket = { age: number; headcount: D };

export function projectWorkforceCohorts(input: {
  cohorts: WorkforceCohortInput[];
  horizonMonths: number;
}) {
  integer(input.horizonMonths, "horizonMonths", 1);
  const ids = new Set<string>();
  const cohorts = input.cohorts.map((cohort, index) => {
    required(cohort.cohortId, `cohorts.${index}.cohortId`);
    required(cohort.role, `${cohort.cohortId}.role`);
    if (ids.has(cohort.cohortId)) throw new Error(`cohortId duplicado: ${cohort.cohortId}.`);
    ids.add(cohort.cohortId);
    integer(cohort.hireMonth, `${cohort.cohortId}.hireMonth`);
    integer(cohort.trainingMonths, `${cohort.cohortId}.trainingMonths`);
    if (cohort.rampCurve.length === 0) throw new Error(`${cohort.cohortId}.rampCurve é obrigatória.`);
    const rampAges = new Set<number>();
    const ramp = cohort.rampCurve.map((entry, rampIndex) => {
      integer(entry.productiveAgeMonth, `${cohort.cohortId}.rampCurve.${rampIndex}.productiveAgeMonth`);
      if (rampAges.has(entry.productiveAgeMonth)) throw new Error(`${cohort.cohortId}.rampCurve possui idade duplicada.`);
      rampAges.add(entry.productiveAgeMonth);
      return { age: entry.productiveAgeMonth, value: rate(entry.productivityRate, `${cohort.cohortId}.rampCurve.${rampIndex}.productivityRate`) };
    }).sort((left, right) => left.age - right.age);
    if (ramp[0]!.age !== 0) throw new Error(`${cohort.cohortId}.rampCurve deve iniciar na idade zero.`);
    return {
      source: cohort,
      headcount: decimal(cohort.headcount, `${cohort.cohortId}.headcount`),
      certification: rate(cohort.certificationRate, `${cohort.cohortId}.certificationRate`),
      matureProductivity: decimal(cohort.matureProductivity, `${cohort.cohortId}.matureProductivity`),
      absenteeism: rate(cohort.absenteeismRate, `${cohort.cohortId}.absenteeismRate`),
      turnover: rate(cohort.monthlyTurnoverRate, `${cohort.cohortId}.monthlyTurnoverRate`),
      monthlyCostPerPerson: sum([
        decimal(cohort.fixedCompensation, `${cohort.cohortId}.fixedCompensation`),
        decimal(cohort.burden, `${cohort.cohortId}.burden`),
        decimal(cohort.guarantee, `${cohort.cohortId}.guarantee`),
        decimal(cohort.allowance, `${cohort.cohortId}.allowance`),
      ]),
      replacementCost: decimal(cohort.replacementCost, `${cohort.cohortId}.replacementCost`),
      ramp,
      buckets: [] as WorkforceBucket[],
    };
  });

  const months = Array.from({ length: input.horizonMonths }, (_, month) => {
    const cohortRows = cohorts.map(cohort => {
      if (month === cohort.source.hireMonth) cohort.buckets.push({ age: 0, headcount: cohort.headcount });
      const active = sum(cohort.buckets.map(bucket => bucket.headcount));
      const effectiveFte = sum(cohort.buckets.map(bucket => {
        if (bucket.age < cohort.source.trainingMonths) return ZERO;
        const productiveAge = bucket.age - cohort.source.trainingMonths;
        const ramp = cohort.ramp.reduce(
          (current, entry) => entry.age <= productiveAge ? entry.value : current,
          ZERO,
        );
        return bucket.headcount
          .times(cohort.certification)
          .times(ramp)
          .times(ONE.minus(cohort.absenteeism));
      }));
      const capacity = effectiveFte.times(cohort.matureProductivity);
      const attrition = active.times(cohort.turnover);
      const replacement = attrition;
      const payroll = active.times(cohort.monthlyCostPerPerson);
      const movementCost = attrition.times(cohort.replacementCost);
      const totalCost = payroll.plus(movementCost);

      cohort.buckets = cohort.buckets
        .map(bucket => ({ age: bucket.age + 1, headcount: bucket.headcount.times(ONE.minus(cohort.turnover)) }))
        .filter(bucket => bucket.headcount.gt(ZERO));
      if (replacement.gt(ZERO)) cohort.buckets.push({ age: 0, headcount: replacement });

      return {
        cohortId: cohort.source.cohortId,
        role: cohort.source.role,
        activeHeadcount: text(active),
        effectiveFte: text(effectiveFte),
        capacity: text(capacity),
        attrition: text(attrition),
        replacements: text(replacement),
        payrollCost: text(payroll),
        replacementCost: text(movementCost),
        totalCost: text(totalCost),
      };
    });
    const total = (key: "activeHeadcount" | "effectiveFte" | "capacity" | "attrition" | "replacements" | "totalCost") =>
      text(sum(cohortRows.map(row => new OperationsDecimal(row[key]))));
    return {
      month,
      activeHeadcount: total("activeHeadcount"),
      effectiveFte: total("effectiveFte"),
      capacity: total("capacity"),
      attrition: total("attrition"),
      replacements: total("replacements"),
      totalCost: total("totalCost"),
      cohorts: cohortRows,
    };
  });
  return {
    months,
    totals: {
      capacity: text(sum(months.map(month => new OperationsDecimal(month.capacity)))),
      attrition: text(sum(months.map(month => new OperationsDecimal(month.attrition)))),
      replacements: text(sum(months.map(month => new OperationsDecimal(month.replacements)))),
      cost: text(sum(months.map(month => new OperationsDecimal(month.totalCost)))),
    },
  };
}

export type TrainingEconomicsInput = {
  trainingId: string;
  candidates: string;
  classes: string;
  durationMonths: number;
  trainers: string;
  trainerMonthlyCost: string;
  candidateMonthlySalary: string;
  monthlySupportCost: string;
  approvalRate: string;
  certificationRate: string;
  timeToProductiveMonths: number;
  targetProductivePeople: string;
  horizonMonths: number;
};

export function calculateTrainingEconomics(input: TrainingEconomicsInput) {
  required(input.trainingId, "trainingId");
  integer(input.durationMonths, "durationMonths", 1);
  integer(input.timeToProductiveMonths, "timeToProductiveMonths");
  integer(input.horizonMonths, "horizonMonths", 1);
  const candidates = decimal(input.candidates, "candidates");
  const classes = decimal(input.classes, "classes");
  if (classes.eq(ZERO)) throw new Error("classes deve ser maior que zero.");
  const trainers = decimal(input.trainers, "trainers");
  const trainerCost = decimal(input.trainerMonthlyCost, "trainerMonthlyCost");
  const candidateSalary = decimal(input.candidateMonthlySalary, "candidateMonthlySalary");
  const supportCost = decimal(input.monthlySupportCost, "monthlySupportCost");
  const approved = candidates.times(rate(input.approvalRate, "approvalRate"));
  const certified = approved.times(rate(input.certificationRate, "certificationRate"));
  const target = decimal(input.targetProductivePeople, "targetProductivePeople");
  const productiveMonth = input.durationMonths + input.timeToProductiveMonths;
  const months = Array.from({ length: input.horizonMonths }, (_, month) => {
    const inTraining = month < input.durationMonths;
    const inProductiveRamp = month >= input.durationMonths && month < productiveMonth;
    const productivePeople = month >= productiveMonth ? certified : ZERO;
    const trainerAndSupport = inTraining ? trainers.times(trainerCost).plus(supportCost) : ZERO;
    const salaryPopulation = inTraining ? candidates : inProductiveRamp ? certified : ZERO;
    const salaryCost = salaryPopulation.times(candidateSalary);
    return {
      month,
      peopleInTraining: text(inTraining ? candidates : ZERO),
      approvedPeople: text(month >= input.durationMonths ? approved : ZERO),
      certifiedPeople: text(month >= input.durationMonths ? certified : ZERO),
      productivePeople: text(productivePeople),
      trainerAndSupportCost: text(trainerAndSupport),
      candidateSalaryCost: text(salaryCost),
      cost: text(trainerAndSupport.plus(salaryCost)),
    };
  });
  const totalCost = sum(months
    .filter(month => month.month <= productiveMonth)
    .map(month => new OperationsDecimal(month.cost)));
  return {
    trainingId: input.trainingId,
    summary: {
      candidatesPerClass: text(candidates.div(classes)),
      approvedPeople: text(approved),
      certifiedPeople: text(certified),
      productivePeople: text(productiveMonth < input.horizonMonths ? certified : ZERO),
      productiveMonth,
      targetProductivePeople: text(target),
      targetGap: text(OperationsDecimal.max(ZERO, target.minus(certified))),
      totalCostToProductive: text(totalCost),
      costPerProductivePerson: certified.eq(ZERO) ? null : text(totalCost.div(certified)),
    },
    months,
  };
}

export type CommissionEligibleBase =
  | "gross_sales"
  | "contracted_entry"
  | "collected_entry"
  | "validated_sale"
  | "d30"
  | "d90"
  | "fixed";

export type CommissionPolicy = {
  policyId: string;
  role: string;
  eligibleBase: CommissionEligibleBase;
  mode: "fixed" | "percentage";
  fixedAmount: string;
  percentageRate: string;
  tiers: Array<{ fromAmount: string; rate: string; accelerator: string }>;
  guarantee: string;
  cutoffDay: number;
  paymentLagMonths: number;
  qualityMultiplier: string;
  holdbackRate: string;
  reversalEnabled: boolean;
};

export type CommissionBaseRecord = {
  recordId: string;
  policyId: string;
  role: string;
  eligibleBase: CommissionEligibleBase;
  month: number;
  day: number;
  amount: string;
  isReversal: boolean;
};

function percentageCommission(base: D, baseRate: D, tiers: Array<{ threshold: D; rate: D }>) {
  let cursor = ZERO;
  let currentRate = baseRate;
  let commission = ZERO;
  for (const tier of tiers) {
    if (base.lte(cursor)) break;
    const upper = OperationsDecimal.min(base, tier.threshold);
    commission = commission.plus(upper.minus(cursor).times(currentRate));
    cursor = tier.threshold;
    currentRate = tier.rate;
  }
  if (base.gt(cursor)) commission = commission.plus(base.minus(cursor).times(currentRate));
  return commission;
}

export function calculateCommissionLedger(input: {
  policies: CommissionPolicy[];
  baseRecords: CommissionBaseRecord[];
}) {
  const policyMap = new Map<string, {
    source: CommissionPolicy;
    fixed: D;
    percentage: D;
    tiers: Array<{ threshold: D; rate: D }>;
    guarantee: D;
    quality: D;
    holdback: D;
  }>();
  const policyKeys = new Set<string>();
  input.policies.forEach((policy, index) => {
    required(policy.policyId, `policies.${index}.policyId`);
    required(policy.role, `${policy.policyId}.role`);
    if (policyMap.has(policy.policyId)) throw new Error(`policyId duplicado: ${policy.policyId}.`);
    const policyKey = `${policy.policyId}|${policy.eligibleBase}|${policy.role}`;
    if (policyKeys.has(policyKey)) throw new Error(`Política duplicada por policyId/base/role: ${policyKey}.`);
    policyKeys.add(policyKey);
    integer(policy.cutoffDay, `${policy.policyId}.cutoffDay`, 1);
    if (policy.cutoffDay > 31) throw new Error(`${policy.policyId}.cutoffDay deve ser no máximo 31.`);
    integer(policy.paymentLagMonths, `${policy.policyId}.paymentLagMonths`);
    const tierThresholds = new Set<string>();
    const tiers = policy.tiers.map((tier, tierIndex) => {
      const threshold = decimal(tier.fromAmount, `${policy.policyId}.tiers.${tierIndex}.fromAmount`);
      if (threshold.eq(ZERO)) throw new Error(`${policy.policyId}.tiers.${tierIndex}.fromAmount deve ser maior que zero.`);
      const key = threshold.toString();
      if (tierThresholds.has(key)) throw new Error(`${policy.policyId}.tiers possui threshold duplicado.`);
      tierThresholds.add(key);
      return {
        threshold,
        rate: rate(tier.rate, `${policy.policyId}.tiers.${tierIndex}.rate`)
          .times(decimal(tier.accelerator, `${policy.policyId}.tiers.${tierIndex}.accelerator`)),
      };
    }).sort((left, right) => left.threshold.cmp(right.threshold));
    policyMap.set(policy.policyId, {
      source: policy,
      fixed: decimal(policy.fixedAmount, `${policy.policyId}.fixedAmount`),
      percentage: rate(policy.percentageRate, `${policy.policyId}.percentageRate`),
      tiers,
      guarantee: decimal(policy.guarantee, `${policy.policyId}.guarantee`),
      quality: rate(policy.qualityMultiplier, `${policy.policyId}.qualityMultiplier`),
      holdback: rate(policy.holdbackRate, `${policy.policyId}.holdbackRate`),
    });
  });

  const countingKeys = new Set<string>();
  const recordIds = new Set<string>();
  const accruals = input.baseRecords.map((record, index) => {
    required(record.recordId, `baseRecords.${index}.recordId`);
    if (recordIds.has(record.recordId)) throw new Error(`recordId duplicado: ${record.recordId}.`);
    recordIds.add(record.recordId);
    integer(record.month, `${record.recordId}.month`);
    integer(record.day, `${record.recordId}.day`, 1);
    if (record.day > 31) throw new Error(`${record.recordId}.day deve ser no máximo 31.`);
    const policy = policyMap.get(record.policyId);
    if (!policy) throw new Error(`${record.recordId}.policyId não referencia política existente.`);
    if (record.role !== policy.source.role || record.eligibleBase !== policy.source.eligibleBase) {
      throw new Error(`${record.recordId} não corresponde ao role/base da política.`);
    }
    const countingKey = `${record.policyId}|${record.eligibleBase}|${record.role}|${record.month}`;
    if (countingKeys.has(countingKey)) throw new Error(`dupla contagem de policyId/base/role/mês: ${countingKey}.`);
    countingKeys.add(countingKey);
    if (record.isReversal && !policy.source.reversalEnabled) {
      throw new Error(`${record.recordId} tenta reversão não permitida pela política.`);
    }
    const base = decimal(record.amount, `${record.recordId}.amount`);
    const calculated = policy.source.mode === "fixed"
      ? policy.fixed
      : percentageCommission(base, policy.percentage, policy.tiers);
    const qualityAdjusted = calculated.times(policy.quality);
    const guaranteed = OperationsDecimal.max(qualityAdjusted, policy.guarantee);
    const signedGross = record.isReversal ? guaranteed.negated() : guaranteed;
    const held = record.isReversal ? ZERO : signedGross.times(policy.holdback);
    const payable = signedGross.minus(held);
    const paymentMonth = record.month + policy.source.paymentLagMonths
      + (record.day > policy.source.cutoffDay ? 1 : 0);
    return {
      recordId: record.recordId,
      policyId: record.policyId,
      role: record.role,
      eligibleBase: record.eligibleBase,
      accrualMonth: record.month,
      paymentMonth,
      eligibleAmount: text(base),
      grossCommission: text(signedGross),
      holdback: text(held),
      payableCommission: text(payable),
      isReversal: record.isReversal,
    };
  });
  const paymentMonths = Array.from(new Set(accruals.map(accrual => accrual.paymentMonth)))
    .sort((left, right) => left - right);
  return {
    accruals,
    payments: paymentMonths.map(month => ({
      month,
      amount: text(sum(accruals
        .filter(accrual => accrual.paymentMonth === month)
        .map(accrual => new OperationsDecimal(accrual.payableCommission)))),
    })),
    totals: {
      accrued: text(sum(accruals.map(accrual => new OperationsDecimal(accrual.grossCommission)))),
      held: text(sum(accruals.map(accrual => new OperationsDecimal(accrual.holdback)))),
      payable: text(sum(accruals.map(accrual => new OperationsDecimal(accrual.payableCommission)))),
    },
  };
}
