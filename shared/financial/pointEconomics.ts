import Decimal from "decimal.js";

const PointDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -30,
  toExpPos: 30,
});

type PointDecimalInstance = InstanceType<typeof PointDecimal>;

const ZERO = new PointDecimal(0);
const ONE = new PointDecimal(1);
const SCALE_MINIMUM_ROI = new PointDecimal(1);
const SCALE_MAXIMUM_PAYBACK_MONTHS = new PointDecimal(12);

export type PointCashflowTreatment =
  | "incremental"
  | "included_in_project_totals";

export type PointClassification = "SCALE" | "OPTIMIZE" | "KILL";

export type PointEconomicsInput = {
  pointId: string;
  name: string;
  channel: string;
  activationCost: string;
  monthlyFixedCost: string;
  costPerSale: string;
  approaches: string;
  researchRate: string;
  qualificationRate: string;
  invitationRate: string;
  appointmentRate: string;
  showRate: string;
  tourRate: string;
  saleRate: string;
  averageTicket: string;
  averageEntry: string;
  contributionMarginRate: string;
  healthyD90Rate: string;
  cannibalizationRate: string;
  cashflowTreatment: PointCashflowTreatment;
};

export type PointFunnel = {
  approaches: string;
  researches: string;
  qualified: string;
  invitations: string;
  appointments: string;
  shows: string;
  tours: string;
  sales: string;
};

export type PointProduction = {
  totalSales: string;
  incrementalSales: string;
  cannibalizedSales: string;
  healthyD90: string;
  incrementalHealthyD90: string;
};

export type PointEconomicsDriver = {
  code: string;
  signal: "positive" | "warning" | "critical";
  message: string;
  value: string | null;
};

export type PointEconomicsResult = {
  pointId: string;
  name: string;
  channel: string;
  funnel: PointFunnel;
  production: PointProduction;
  costs: {
    activation: string;
    monthlyFixed: string;
    monthlyVariable: string;
    monthlyOperating: string;
    perApproach: string | null;
    perQualified: string | null;
    perShow: string | null;
    perTour: string | null;
    perSale: string | null;
    perHealthyD90: string | null;
  };
  value: {
    grossSales: string;
    incrementalSales: string;
    cannibalizedSales: string;
    grossEntry: string;
    grossContribution: string;
    d90Contribution: string;
    incrementalGrossContribution: string;
    incrementalNetContribution: string;
  };
  unitEconomics: {
    grossVpg: string | null;
    d90Vpg: string | null;
    averageEntry: string | null;
    contributionPerTour: string | null;
    contributionPerHealthyD90: string | null;
    breakEvenSales: string | null;
    monthlyRoi: string | null;
    paybackMonths: string | null;
  };
  cashflow: {
    treatment: PointCashflowTreatment;
    incrementalCapex: string;
    incrementalMonthlyOpex: string;
  };
  classification: PointClassification;
  drivers: PointEconomicsDriver[];
  reconciliation: {
    productionDifference: string;
    salesValueDifference: string;
  };
};

export type PointEconomicsPortfolio = {
  points: PointEconomicsResult[];
  totals: {
    pointCount: number;
    funnel: PointFunnel;
    production: PointProduction;
    value: PointEconomicsResult["value"];
    cashflow: {
      totalActivationCost: string;
      totalMonthlyOperatingCost: string;
      incrementalCapex: string;
      incrementalMonthlyOpex: string;
    };
    classificationCounts: Record<PointClassification, number>;
    reconciliation: PointEconomicsResult["reconciliation"];
  };
};

type ValidatedPoint = {
  source: PointEconomicsInput;
  activationCost: PointDecimalInstance;
  monthlyFixedCost: PointDecimalInstance;
  costPerSale: PointDecimalInstance;
  approaches: PointDecimalInstance;
  rates: {
    research: PointDecimalInstance;
    qualification: PointDecimalInstance;
    invitation: PointDecimalInstance;
    appointment: PointDecimalInstance;
    show: PointDecimalInstance;
    tour: PointDecimalInstance;
    sale: PointDecimalInstance;
    contributionMargin: PointDecimalInstance;
    healthyD90: PointDecimalInstance;
    cannibalization: PointDecimalInstance;
  };
  averageTicket: PointDecimalInstance;
  averageEntry: PointDecimalInstance;
};

function decimalText(value: PointDecimalInstance): string {
  const normalized = value.eq(ZERO) ? ZERO : value;
  return normalized.toFixed(8);
}

function readNonNegativeDecimal(
  value: string,
  field: string,
): PointDecimalInstance {
  let parsed: PointDecimalInstance;
  try {
    parsed = new PointDecimal(value);
  } catch {
    throw new Error(`${field} deve ser decimal válido.`);
  }
  if (!parsed.isFinite() || parsed.lt(ZERO)) {
    throw new Error(`${field} deve ser decimal não negativo.`);
  }
  return parsed;
}

function readRate(value: string, field: string): PointDecimalInstance {
  const parsed = readNonNegativeDecimal(value, field);
  if (parsed.gt(ONE)) throw new Error(`${field} deve estar entre 0 e 1.`);
  return parsed;
}

function validatePoint(point: PointEconomicsInput): ValidatedPoint {
  if (!point.pointId.trim()) throw new Error("pointId é obrigatório.");
  if (!point.name.trim()) throw new Error(`${point.pointId}.name é obrigatório.`);
  if (!point.channel.trim()) throw new Error(`${point.pointId}.channel é obrigatório.`);
  if (
    point.cashflowTreatment !== "incremental" &&
    point.cashflowTreatment !== "included_in_project_totals"
  ) {
    throw new Error(`${point.pointId}.cashflowTreatment é inválido.`);
  }

  return {
    source: point,
    activationCost: readNonNegativeDecimal(
      point.activationCost,
      `${point.pointId}.activationCost`,
    ),
    monthlyFixedCost: readNonNegativeDecimal(
      point.monthlyFixedCost,
      `${point.pointId}.monthlyFixedCost`,
    ),
    costPerSale: readNonNegativeDecimal(
      point.costPerSale,
      `${point.pointId}.costPerSale`,
    ),
    approaches: readNonNegativeDecimal(
      point.approaches,
      `${point.pointId}.approaches`,
    ),
    rates: {
      research: readRate(point.researchRate, `${point.pointId}.researchRate`),
      qualification: readRate(
        point.qualificationRate,
        `${point.pointId}.qualificationRate`,
      ),
      invitation: readRate(
        point.invitationRate,
        `${point.pointId}.invitationRate`,
      ),
      appointment: readRate(
        point.appointmentRate,
        `${point.pointId}.appointmentRate`,
      ),
      show: readRate(point.showRate, `${point.pointId}.showRate`),
      tour: readRate(point.tourRate, `${point.pointId}.tourRate`),
      sale: readRate(point.saleRate, `${point.pointId}.saleRate`),
      contributionMargin: readRate(
        point.contributionMarginRate,
        `${point.pointId}.contributionMarginRate`,
      ),
      healthyD90: readRate(
        point.healthyD90Rate,
        `${point.pointId}.healthyD90Rate`,
      ),
      cannibalization: readRate(
        point.cannibalizationRate,
        `${point.pointId}.cannibalizationRate`,
      ),
    },
    averageTicket: readNonNegativeDecimal(
      point.averageTicket,
      `${point.pointId}.averageTicket`,
    ),
    averageEntry: readNonNegativeDecimal(
      point.averageEntry,
      `${point.pointId}.averageEntry`,
    ),
  };
}

function safeDivide(
  numerator: PointDecimalInstance,
  denominator: PointDecimalInstance,
): string | null {
  if (denominator.eq(ZERO)) return null;
  return decimalText(numerator.div(denominator));
}

function sum(values: readonly PointDecimalInstance[]): PointDecimalInstance {
  return values.reduce(
    (total, value) => total.plus(value),
    new PointDecimal(0),
  );
}

function classifyPoint(input: {
  healthyD90: PointDecimalInstance;
  incrementalNetContribution: PointDecimalInstance;
  monthlyRoi: string | null;
  paybackMonths: string | null;
}): { classification: PointClassification; drivers: PointEconomicsDriver[] } {
  const drivers: PointEconomicsDriver[] = [];

  if (input.healthyD90.lte(ZERO)) {
    drivers.push({
      code: "healthy_d90_absent",
      signal: "critical",
      message: "O ponto não produz contratos Healthy D90.",
      value: decimalText(input.healthyD90),
    });
  }
  if (input.incrementalNetContribution.lte(ZERO)) {
    drivers.push({
      code: "incremental_contribution_non_positive",
      signal: "critical",
      message: "A contribuição incremental líquida mensal não é positiva.",
      value: decimalText(input.incrementalNetContribution),
    });
  }
  if (drivers.length > 0) return { classification: "KILL", drivers };

  const roi = input.monthlyRoi === null ? null : new PointDecimal(input.monthlyRoi);
  const payback = input.paybackMonths === null
    ? null
    : new PointDecimal(input.paybackMonths);
  const roiScales = roi !== null && roi.gte(SCALE_MINIMUM_ROI);
  const paybackScales = payback !== null && payback.lte(SCALE_MAXIMUM_PAYBACK_MONTHS);

  drivers.push({
    code: roiScales ? "monthly_roi_scale" : "monthly_roi_optimize",
    signal: roiScales ? "positive" : "warning",
    message: roiScales
      ? "O ROI mensal é igual ou superior a 1x."
      : "O ROI mensal está abaixo de 1x ou não é calculável.",
    value: input.monthlyRoi,
  });
  drivers.push({
    code: paybackScales ? "payback_scale" : "payback_optimize",
    signal: paybackScales ? "positive" : "warning",
    message: paybackScales
      ? "O payback ocorre em até 12 meses."
      : "O payback excede 12 meses ou não é calculável.",
    value: input.paybackMonths,
  });
  drivers.push({
    code: "incremental_contribution_positive",
    signal: "positive",
    message: "A contribuição incremental líquida mensal é positiva.",
    value: decimalText(input.incrementalNetContribution),
  });

  return {
    classification: roiScales && paybackScales ? "SCALE" : "OPTIMIZE",
    drivers,
  };
}

function calculatePoint(point: ValidatedPoint): PointEconomicsResult {
  const researches = point.approaches.times(point.rates.research);
  const qualified = researches.times(point.rates.qualification);
  const invitations = qualified.times(point.rates.invitation);
  const appointments = invitations.times(point.rates.appointment);
  const shows = appointments.times(point.rates.show);
  const tours = shows.times(point.rates.tour);
  const sales = tours.times(point.rates.sale);
  const incrementalSales = sales.times(ONE.minus(point.rates.cannibalization));
  const healthyD90 = sales.times(point.rates.healthyD90);
  const incrementalHealthyD90 = incrementalSales.times(point.rates.healthyD90);

  const monthlyVariableCost = sales.times(point.costPerSale);
  const monthlyOperatingCost = point.monthlyFixedCost.plus(monthlyVariableCost);
  const grossSalesValue = sales.times(point.averageTicket);
  const incrementalSalesValue = incrementalSales.times(point.averageTicket);
  const grossEntryValue = sales.times(point.averageEntry);
  const grossContribution = grossSalesValue.times(point.rates.contributionMargin);
  const d90Contribution = grossContribution.times(point.rates.healthyD90);
  const incrementalGrossContribution = incrementalSalesValue.times(
    point.rates.contributionMargin,
  );
  const incrementalNetContribution = incrementalGrossContribution.minus(
    monthlyOperatingCost,
  );
  const contributionPerGrossSale = point.averageTicket
    .times(point.rates.contributionMargin)
    .times(ONE.minus(point.rates.cannibalization))
    .minus(point.costPerSale);
  const breakEvenSales = contributionPerGrossSale.gt(ZERO)
    ? safeDivide(point.monthlyFixedCost, contributionPerGrossSale)
    : null;
  const monthlyRoi = safeDivide(
    incrementalNetContribution,
    monthlyOperatingCost,
  );
  const paybackMonths = point.activationCost.eq(ZERO) && incrementalNetContribution.gt(ZERO)
    ? decimalText(ZERO)
    : incrementalNetContribution.gt(ZERO)
      ? safeDivide(point.activationCost, incrementalNetContribution)
      : null;
  const classification = classifyPoint({
    healthyD90,
    incrementalNetContribution,
    monthlyRoi,
    paybackMonths,
  });
  const totalSalesText = decimalText(sales);
  const incrementalSalesText = decimalText(incrementalSales);
  const cannibalizedSalesText = decimalText(
    new PointDecimal(totalSalesText).minus(incrementalSalesText),
  );
  const grossSalesValueText = decimalText(grossSalesValue);
  const incrementalSalesValueText = decimalText(incrementalSalesValue);
  const cannibalizedSalesValueText = decimalText(
    new PointDecimal(grossSalesValueText).minus(incrementalSalesValueText),
  );

  return {
    pointId: point.source.pointId,
    name: point.source.name,
    channel: point.source.channel,
    funnel: {
      approaches: decimalText(point.approaches),
      researches: decimalText(researches),
      qualified: decimalText(qualified),
      invitations: decimalText(invitations),
      appointments: decimalText(appointments),
      shows: decimalText(shows),
      tours: decimalText(tours),
      sales: decimalText(sales),
    },
    production: {
      totalSales: totalSalesText,
      incrementalSales: incrementalSalesText,
      cannibalizedSales: cannibalizedSalesText,
      healthyD90: decimalText(healthyD90),
      incrementalHealthyD90: decimalText(incrementalHealthyD90),
    },
    costs: {
      activation: decimalText(point.activationCost),
      monthlyFixed: decimalText(point.monthlyFixedCost),
      monthlyVariable: decimalText(monthlyVariableCost),
      monthlyOperating: decimalText(monthlyOperatingCost),
      perApproach: safeDivide(monthlyOperatingCost, point.approaches),
      perQualified: safeDivide(monthlyOperatingCost, qualified),
      perShow: safeDivide(monthlyOperatingCost, shows),
      perTour: safeDivide(monthlyOperatingCost, tours),
      perSale: safeDivide(monthlyOperatingCost, sales),
      perHealthyD90: safeDivide(monthlyOperatingCost, healthyD90),
    },
    value: {
      grossSales: grossSalesValueText,
      incrementalSales: incrementalSalesValueText,
      cannibalizedSales: cannibalizedSalesValueText,
      grossEntry: decimalText(grossEntryValue),
      grossContribution: decimalText(grossContribution),
      d90Contribution: decimalText(d90Contribution),
      incrementalGrossContribution: decimalText(incrementalGrossContribution),
      incrementalNetContribution: decimalText(incrementalNetContribution),
    },
    unitEconomics: {
      grossVpg: safeDivide(grossSalesValue, tours),
      d90Vpg: safeDivide(grossSalesValue.times(point.rates.healthyD90), tours),
      averageEntry: safeDivide(grossEntryValue, sales),
      contributionPerTour: safeDivide(grossContribution, tours),
      contributionPerHealthyD90: safeDivide(d90Contribution, healthyD90),
      breakEvenSales,
      monthlyRoi,
      paybackMonths,
    },
    cashflow: {
      treatment: point.source.cashflowTreatment,
      incrementalCapex: point.source.cashflowTreatment === "incremental"
        ? decimalText(point.activationCost)
        : decimalText(ZERO),
      incrementalMonthlyOpex: point.source.cashflowTreatment === "incremental"
        ? decimalText(monthlyOperatingCost)
        : decimalText(ZERO),
    },
    classification: classification.classification,
    drivers: classification.drivers,
    reconciliation: {
      productionDifference: decimalText(
        new PointDecimal(totalSalesText).minus(
          new PointDecimal(incrementalSalesText).plus(cannibalizedSalesText),
        ),
      ),
      salesValueDifference: decimalText(
        new PointDecimal(grossSalesValueText).minus(
          new PointDecimal(incrementalSalesValueText).plus(
            cannibalizedSalesValueText,
          ),
        ),
      ),
    },
  };
}

function sumText<T>(
  results: readonly T[],
  select: (result: T) => string,
): string {
  return decimalText(sum(results.map(result => new PointDecimal(select(result)))));
}

export function calculatePointEconomics(input: {
  points: PointEconomicsInput[];
}): PointEconomicsPortfolio {
  const seenPointIds = new Set<string>();
  const validated = input.points.map(point => {
    if (seenPointIds.has(point.pointId)) {
      throw new Error(`pointId duplicado: ${point.pointId}.`);
    }
    seenPointIds.add(point.pointId);
    return validatePoint(point);
  });
  const points = validated.map(calculatePoint);

  const sumFunnel = (key: keyof PointFunnel) =>
    sumText(points, result => result.funnel[key]);
  const sumProduction = (key: keyof PointProduction) =>
    sumText(points, result => result.production[key]);
  const sumValue = (key: keyof PointEconomicsResult["value"]) =>
    sumText(points, result => result.value[key]);

  const totalSales = new PointDecimal(sumProduction("totalSales"));
  const incrementalSales = new PointDecimal(sumProduction("incrementalSales"));
  const cannibalizedSales = new PointDecimal(sumProduction("cannibalizedSales"));
  const grossSalesValue = new PointDecimal(sumValue("grossSales"));
  const incrementalSalesValue = new PointDecimal(sumValue("incrementalSales"));
  const cannibalizedSalesValue = new PointDecimal(sumValue("cannibalizedSales"));

  return {
    points,
    totals: {
      pointCount: points.length,
      funnel: {
        approaches: sumFunnel("approaches"),
        researches: sumFunnel("researches"),
        qualified: sumFunnel("qualified"),
        invitations: sumFunnel("invitations"),
        appointments: sumFunnel("appointments"),
        shows: sumFunnel("shows"),
        tours: sumFunnel("tours"),
        sales: sumFunnel("sales"),
      },
      production: {
        totalSales: decimalText(totalSales),
        incrementalSales: decimalText(incrementalSales),
        cannibalizedSales: decimalText(cannibalizedSales),
        healthyD90: sumProduction("healthyD90"),
        incrementalHealthyD90: sumProduction("incrementalHealthyD90"),
      },
      value: {
        grossSales: decimalText(grossSalesValue),
        incrementalSales: decimalText(incrementalSalesValue),
        cannibalizedSales: decimalText(cannibalizedSalesValue),
        grossEntry: sumValue("grossEntry"),
        grossContribution: sumValue("grossContribution"),
        d90Contribution: sumValue("d90Contribution"),
        incrementalGrossContribution: sumValue("incrementalGrossContribution"),
        incrementalNetContribution: sumValue("incrementalNetContribution"),
      },
      cashflow: {
        totalActivationCost: sumText(points, result => result.costs.activation),
        totalMonthlyOperatingCost: sumText(
          points,
          result => result.costs.monthlyOperating,
        ),
        incrementalCapex: sumText(
          points,
          result => result.cashflow.incrementalCapex,
        ),
        incrementalMonthlyOpex: sumText(
          points,
          result => result.cashflow.incrementalMonthlyOpex,
        ),
      },
      classificationCounts: {
        SCALE: points.filter(point => point.classification === "SCALE").length,
        OPTIMIZE: points.filter(point => point.classification === "OPTIMIZE").length,
        KILL: points.filter(point => point.classification === "KILL").length,
      },
      reconciliation: {
        productionDifference: sumText(
          points,
          result => result.reconciliation.productionDifference,
        ),
        salesValueDifference: sumText(
          points,
          result => result.reconciliation.salesValueDifference,
        ),
      },
    },
  };
}
