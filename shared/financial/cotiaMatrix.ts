export type CotiaMatrixValues = Record<string, string | undefined>;

import {
  CAPTATION_CHANNELS,
  COMMERCIAL_TEAM_ROLES,
  SALES_KIT_INVESTMENTS,
  SALES_ROOM_INVESTMENTS,
} from "./cotiaInvestmentCatalog";

export function normalizeBrazilianDecimal(value: string | undefined) {
  const cleaned = (value ?? "")
    .trim()
    .replace(/^R\$\s?/, "")
    .replace(/%$/, "")
    .replace(/\s/g, "");
  if (!cleaned) return null;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");
  let normalized = cleaned;
  if (comma >= 0 && dot >= 0) {
    const decimalSeparator = comma > dot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    normalized = cleaned
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  } else if (comma >= 0) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (dot >= 0) {
    const parts = cleaned.split(".");
    const looksLikeBrazilianThousands =
      parts.length > 2 ||
      (parts.length === 2 && parts[0] !== "0" && parts[1]?.length === 3 && parts[0]!.length <= 3);
    if (looksLikeBrazilianThousands) normalized = parts.join("");
  }
  return /^-?\d+(?:\.\d+)?$/.test(normalized) ? normalized : null;
}

export function parseBrazilianDecimal(value: string | undefined) {
  const normalized = normalizeBrazilianDecimal(value);
  const parsed = normalized === null ? Number.NaN : Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateCotiaMatrix(values: CotiaMatrixValues) {
  const n = (key: string) => parseBrazilianDecimal(values[key]);
  const commissionRoles = [
    "comissaoCorretor",
    "comissaoFechador",
    "comissaoCaptador",
    "comissaoLiderCaptacao",
    "comissaoSubLider",
    "comissaoGerenteSala",
    "comissaoGerenteFinanceiro",
  ];
  const salesRoomRoles = [
    "admContratos",
    "salaKids",
    "recepcao",
    "liderAdmFinanceiro",
    "gerenteAdm",
    "garcom",
    "limpeza",
    "seguranca",
  ];
  const operatingCosts = [
    "utilidades",
    "carros",
    "impressoras",
    "materiais",
    "marketingTi",
    "juridicoContabil",
  ];
  const paymentMethods = [
    "cartaoVista",
    "cartaoParcelado",
    "debito",
    "recorrenteCheque",
    "boleto",
  ];

  const physicalShares = Math.max(0, n("cotasPorApartamento") * n("totalApartamentos"));
  const blockedShares = Math.max(0, n("cotasBloqueadas"));
  const grossSoldShares = Math.max(0, n("cotasVendidasAcumuladas"));
  const returnedShares = Math.max(0, n("cotasRetornadas"));
  const activeSoldShares = Math.max(0, grossSoldShares - returnedShares);
  const totalShares = Math.max(0, physicalShares - blockedShares);
  const availableInventory = Math.max(0, totalShares - activeSoldShares);
  const inventoryViolation = n("cotasBloqueadas") < 0
    ? "Cotas bloqueadas nao podem ser negativas."
    : n("cotasVendidasAcumuladas") < 0 || n("cotasRetornadas") < 0
      ? "Vendas e devolucoes acumuladas nao podem ser negativas."
      : returnedShares > grossSoldShares
        ? "Cotas retornadas nao podem exceder as vendas acumuladas."
    : blockedShares > physicalShares
      ? "Cotas bloqueadas nao podem exceder o estoque fisico."
      : activeSoldShares + blockedShares > physicalShares
        ? "Vendas ativas e bloqueios nao podem exceder o estoque fisico."
      : null;
  const commissionPerShare = commissionRoles.reduce(
    (total, role) => total + n(`${role}Valor`) * n(`${role}Quantidade`),
    0
  );
  const roomHeadcount = salesRoomRoles.reduce(
    (total, role) => total + n(`${role}Quantidade`),
    0
  );
  const roomPayroll = salesRoomRoles.reduce(
    (total, role) => total + n(`${role}Quantidade`) * n(`${role}Salario`),
    0
  );
  const roomBenefits =
    roomHeadcount * n("passagemDia") * n("diasOperacaoMes") +
    roomHeadcount * n("refeicaoDia") * n("diasOperacaoMes");
  const roomMonthly =
    roomPayroll + roomBenefits + (roomPayroll + roomBenefits) * (n("encargosSala") / 100);
  const postSalesPayroll =
    n("posVendaConsultores") *
    (n("posVendaSalario") + n("posVendaAlmoco") + n("posVendaTransporte"));
  const postSalesMonthly =
    postSalesPayroll + postSalesPayroll * (n("posVendaEncargos") / 100);
  const opexMonthly = operatingCosts.reduce(
    (total, line) => total + n(`${line}Mensal`),
    0
  );
  const captadores = n("captadoresQuantidade");
  const abordagensPotenciais = captadores * n("captadorAbordagensMes");
  const casaisQualificados = abordagensPotenciais * (n("captadorTaxaQualificacao") / 100);
  const ntProjetadas = casaisQualificados * (n("captadorTaxaComparecimento") / 100);
  const captacaoFixaMensal = captadores * n("captadorFixoMensal");
  const captacaoVariavelMensal = casaisQualificados * n("captadorIncentivoPorCasal");
  const captacaoMensal =
    captacaoFixaMensal + captacaoVariavelMensal + n("canalMidiaMensal");
  const channelMetrics = CAPTATION_CHANNELS.map(channel => {
    const approaches = n(`${channel.key}AbordagensMes`);
    const research = approaches * (n(`${channel.key}PesquisaRate`) / 100);
    const qualified = approaches
      ? research * (n(`${channel.key}QualificacaoRate`) / 100)
      : n(`${channel.key}QualificadosMes`);
    const invites = qualified * (n(`${channel.key}ConviteRate`) / 100);
    const appointments = invites * (n(`${channel.key}AgendamentoRate`) / 100);
    const shows = appointments * (n(`${channel.key}ShowRate`) / 100);
    const tours = shows * (n(`${channel.key}TourRate`) / 100);
    const sales = tours * (n(`${channel.key}Conversao`) / 100);
    const activeD90 = sales * (n(`${channel.key}AtivoD90`) / 100);
    const commissionMonthly = n(`${channel.key}ComissaoPorVenda`) * sales;
    const monthlyCost = n(`${channel.key}RecorrenteMensal`) + commissionMonthly;
    return {
      key: channel.key,
      activation: n(`${channel.key}AtivacaoInicial`),
      approaches,
      research,
      qualified,
      invites,
      appointments,
      attendance: shows,
      shows,
      tours,
      sales,
      activeD90,
      commissionMonthly,
      monthlyCost,
      costPerApproach: approaches ? monthlyCost / approaches : 0,
      costPerResearch: research ? monthlyCost / research : 0,
      costPerQualified: qualified ? monthlyCost / qualified : 0,
      costPerInvite: invites ? monthlyCost / invites : 0,
      costPerAppointment: appointments ? monthlyCost / appointments : 0,
      costPerAttendance: shows ? monthlyCost / shows : 0,
      costPerTour: tours ? monthlyCost / tours : 0,
      costPerSale: sales ? monthlyCost / sales : 0,
      vpg: sales * n("valorCota"),
    };
  });
  const channelActivation = channelMetrics.reduce((total, channel) => total + channel.activation, 0);
  const channelRecurring = channelMetrics.reduce((total, channel) => total + channel.monthlyCost, 0);
  const salesRoomImplementationInvestment = SALES_ROOM_INVESTMENTS.reduce((total, item) => total + n(`${item.key}Quantidade`) * n(`${item.key}CustoUnitario`), 0);
  const salesKitImplementationInvestment = SALES_KIT_INVESTMENTS.reduce((total, item) => total + n(`${item.key}Quantidade`) * n(`${item.key}CustoUnitario`), 0);
  const implementationInvestment = salesRoomImplementationInvestment + salesKitImplementationInvestment;
  const commercialTeamFixed = COMMERCIAL_TEAM_ROLES.reduce((total, role) => total + n(`${role.key}Quantidade`) * n(`${role.key}FixoMensal`), 0);
  const channelSales = channelMetrics.reduce((total, channel) => total + channel.sales, 0);
  const commercialSalesBasis = n("cotasVendidasMes") || channelSales;
  const commercialTeamMetrics = COMMERCIAL_TEAM_ROLES.map(role => {
    const headcount = n(`${role.key}Quantidade`);
    const fixedMonthly = n(`${role.key}FixoMensal`);
    const commissionPerSale = n(`${role.key}ComissaoPorVenda`);
    const productivityMonthly = n(`${role.key}ProdutividadeMes`);
    const capacityMonthly = headcount * productivityMonthly;
    const fixedCost = headcount * fixedMonthly;
    const commissionMonthly = commercialSalesBasis * commissionPerSale;
    const costPerSale = commercialSalesBasis ? (fixedCost + commissionMonthly) / commercialSalesBasis : 0;
    return { key: role.key, headcount, fixedMonthly, commissionPerSale, productivityMonthly, capacityMonthly, fixedCost, commissionMonthly, costPerSale };
  });
  const commercialTeamCommissionMonthly = commercialTeamMetrics.reduce((total, role) => total + role.commissionMonthly, 0);
  const commercialTeamCapacity = commercialTeamMetrics.reduce((total, role) => total + role.capacityMonthly, 0);
  const weightedMdrRate = paymentMethods.reduce((total, method) => total + (n(`${method}Percentual`) * n(`${method}Taxa`)) / 100, 0);
  const grossEntryMonthly = n("cotasVendidasMes") * n("valorEntrada");
  const netEntryMonthly = grossEntryMonthly * (1 - weightedMdrRate / 100);

  return {
    entryInstallmentValue: n("parcelasEntrada")
      ? n("valorEntrada") / n("parcelasEntrada")
      : 0,
    physicalShares,
    blockedShares,
    grossSoldShares,
    returnedShares,
    activeSoldShares,
    availableInventory,
    sellableShares: totalShares,
    totalShares,
    inventoryViolation,
    grossValue: totalShares * n("valorCota"),
    entrancePotential: totalShares * n("valorEntrada"),
    monthsOfOperation: n("cotasVendidasMes")
      ? availableInventory / n("cotasVendidasMes")
      : 0,
    commissionPerShare,
    postSalesMonthly,
    roomMonthly,
    opexMonthly,
    operationalMonthly:
      roomMonthly +
      postSalesMonthly +
      opexMonthly +
      commissionPerShare * n("cotasVendidasMes"),
    captadores,
    abordagensPotenciais,
    casaisQualificados,
    ntProjetadas,
    captacaoFixaMensal,
    captacaoVariavelMensal,
    captacaoMensal,
    captacaoAtivacaoInicial: n("canalAtivacaoInicial"),
    custoPorCasalQualificado: casaisQualificados
      ? captacaoMensal / casaisQualificados
      : 0,
    custoPorNt: ntProjetadas ? captacaoMensal / ntProjetadas : 0,
    channelMetrics,
    channelActivation,
    channelRecurring,
    acquisitionImplementationInvestment: n("canalAtivacaoInicial") + channelActivation,
    salesRoomImplementationInvestment,
    salesKitImplementationInvestment,
    implementationInvestment,
    commercialTeamFixed,
    commercialSalesBasis,
    commercialTeamMetrics,
    commercialTeamCommissionMonthly,
    commercialTeamCapacity,
    preOperationalInvestment: n("canalAtivacaoInicial") + channelActivation + implementationInvestment,
    recurringOperationMonthly: roomMonthly + postSalesMonthly + opexMonthly + captacaoMensal + channelRecurring + commercialTeamFixed + commercialTeamCommissionMonthly,
    weightedMdrRate,
    grossEntryMonthly,
    netEntryMonthly,
    paymentMix: paymentMethods.reduce(
      (total, method) => total + n(`${method}Percentual`),
      0
    ),
  };
}
