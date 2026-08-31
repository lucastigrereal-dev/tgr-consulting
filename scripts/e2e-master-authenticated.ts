import { chromium, type Browser, type Page } from "playwright-core";
import JSZip from "jszip";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, mkdtemp } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { LIVE_DOCUMENT_CHAPTERS } from "../client/src/lib/liveDocumentStructure";
import { COOKIE_NAME } from "../shared/const";
import type { FinancialInputSnapshot } from "../shared/financial/types";

type Evidence = {
  id: number;
  name: string;
  mode: "browser" | "api" | "domain" | "hybrid";
  evidence?: string;
};

const repoRoot = process.cwd();
const dbPort = Number(process.env.TGR_E2E_DB_PORT ?? "13308");
const appPort = Number(process.env.TGR_E2E_APP_PORT ?? "3108");
const databaseUrl = `mysql://root@127.0.0.1:${dbPort}/tgr_consulting_test`;
const jwtSecret = randomBytes(32).toString("hex");
const pnpmCli = path.join(repoRoot, "node_modules", "pnpm", "bin", "pnpm.cjs");
const ownerOpenId = "tgr-master-e2e-owner";
const ownerName = "TGR Master E2E Owner";
const sourceRef = "master-authenticated-e2e";
const storage = new Map<string, Buffer>();
const adversarialCases: Evidence[] = [
  { id: 1, name: "material assumption pending", mode: "domain" },
  { id: 2, name: "invalid price reconciliation", mode: "domain" },
  { id: 3, name: "payment mix < 100%", mode: "domain" },
  { id: 4, name: "payment mix > 100%", mode: "domain" },
  { id: 5, name: "MDR pending", mode: "domain" },
  { id: 6, name: "stock exhausted", mode: "domain" },
  { id: 7, name: "sales > stock", mode: "domain" },
  { id: 8, name: "tours > room capacity", mode: "domain" },
  { id: 9, name: "sales > workforce capacity", mode: "domain" },
  { id: 10, name: "no training capacity", mode: "domain" },
  { id: 11, name: "point below break-even", mode: "domain" },
  { id: 12, name: "cancellation 0%", mode: "domain" },
  { id: 13, name: "cancellation extreme", mode: "domain" },
  { id: 14, name: "delinquency extreme", mode: "domain" },
  { id: 15, name: "recovery/cure", mode: "domain" },
  { id: 16, name: "delayed settlement", mode: "domain" },
  { id: 17, name: "no sales", mode: "domain" },
  { id: 18, name: "early sellout", mode: "domain" },
  { id: 19, name: "goal seek unreachable", mode: "domain" },
  { id: 20, name: "goal seek iteration limit", mode: "domain" },
  { id: 21, name: "invalid solver bounds", mode: "domain" },
  { id: 22, name: "baseline mutation", mode: "api" },
  { id: 23, name: "cross tenant access", mode: "api" },
  { id: 24, name: "unauthorized export", mode: "api" },
  { id: 25, name: "export from temporary simulation", mode: "api" },
  { id: 26, name: "corrupted/invalid input", mode: "api" },
  { id: 27, name: "large horizon", mode: "domain" },
  { id: 28, name: "repeated save/idempotency", mode: "api" },
  { id: 29, name: "logout/session restoration with fresh local test token", mode: "browser" },
  { id: 30, name: "browser reload", mode: "browser" },
];

function provided(value: string) {
  return { status: "provided" as const, value, sourceType: "current_decision" as const, sourceRef };
}

function baseInputs(overrides: Partial<Record<keyof FinancialInputSnapshot, ReturnType<typeof provided>>> = {}): FinancialInputSnapshot {
  return {
    qualifiedCouplesMonth1: provided("100"),
    qualifiedCouplesGrowthRate: provided("0"),
    conversionRate: provided("0.1"),
    averageTicket: provided("110000"),
    collectionRate: provided("0.9"),
    cancellationRate: provided("0.05"),
    variableCostRate: provided("0.12"),
    partnerShareRate: provided("0.03"),
    fixedCostMonthly: provided("20000"),
    payrollMonthly: provided("30000"),
    capexInitial: provided("150000"),
    capexAcquisitionShareRate: provided("0.3"),
    capexAcquisitionMonth: provided("1"),
    capexSalesRoomShareRate: provided("0.4"),
    capexSalesRoomMonth: provided("1"),
    capexSalesKitShareRate: provided("0.3"),
    capexSalesKitMonth: provided("1"),
    preOperationMonths: provided("1"),
    entryValuePerContract: provided("20000"),
    paymentCardViewMixRate: provided("0.4"),
    paymentCardViewMdrRate: provided("0.03"),
    paymentCardViewSettlementDays: provided("2"),
    paymentCardInstallmentMixRate: provided("0.3"),
    paymentCardInstallmentMdrRate: provided("0.04"),
    paymentCardInstallmentSettlementDays: provided("30"),
    paymentDebitMixRate: provided("0.2"),
    paymentDebitMdrRate: provided("0.02"),
    paymentDebitSettlementDays: provided("1"),
    paymentRecurringChequeMixRate: provided("0.05"),
    paymentRecurringChequeMdrRate: provided("0"),
    paymentRecurringChequeSettlementDays: provided("30"),
    paymentBoletoMixRate: provided("0.05"),
    paymentBoletoMdrRate: provided("0.01"),
    paymentBoletoSettlementDays: provided("5"),
    discountRateAnnual: provided("0.12"),
    ...overrides,
  };
}

function markCase(id: number, evidence: string) {
  const item = adversarialCases.find(candidate => candidate.id === id);
  if (!item) throw new Error(`Unknown adversarial case ${id}`);
  item.evidence = evidence;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function expectThrows(action: () => unknown, message: string) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(message);
}

function assertCaseManifestComplete() {
  const missing = adversarialCases.filter(item => !item.evidence);
  if (missing.length) {
    throw new Error(`Adversarial manifest incomplete: ${missing.map(item => `${item.id}:${item.name}`).join(", ")}`);
  }
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<void>((resolve, reject) => {
    const executable = command === "pnpm" ? process.execPath : command;
    const executableArgs = command === "pnpm" ? [pnpmCli, ...args] : args;
    const child = spawn(executable, executableArgs, {
      cwd: repoRoot,
      env,
      shell: false,
      stdio: "inherit",
    });
    child.on("exit", code => {
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

async function startLocalForge() {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const host = req.headers.host ?? "127.0.0.1";
    const url = new URL(req.url ?? "/", `http://${host}`);
    if (url.pathname === "/v1/storage/presign/put") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ url: `http://${host}/upload?path=${encodeURIComponent(url.searchParams.get("path") ?? "")}` }));
      return;
    }
    if (url.pathname === "/v1/storage/presign/get") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ url: `http://${host}/download?path=${encodeURIComponent(url.searchParams.get("path") ?? "")}` }));
      return;
    }
    if (url.pathname === "/upload" && req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const key = url.searchParams.get("path") ?? "";
      storage.set(key, Buffer.concat(chunks));
      res.statusCode = 200;
      res.end("ok");
      return;
    }
    if (url.pathname === "/download") {
      const key = url.searchParams.get("path") ?? "";
      const data = storage.get(key);
      if (!data) {
        res.statusCode = 404;
        res.end("missing");
        return;
      }
      res.end(data);
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address === "object", "Local Forge did not bind to a TCP port.");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean) as string[];
  return candidates.find(candidate => existsSync(candidate));
}

async function startApp(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, [pnpmCli, "exec", "tsx", "server/_core/index.ts"], {
    cwd: repoRoot,
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const ready = new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`App server did not become ready. Output:\n${output}`)), 60_000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      const match = output.match(/Server running on (http:\/\/localhost:\d+)\//);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]!);
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("exit", code => {
      clearTimeout(timer);
      reject(new Error(`App server exited early with code ${code}. Output:\n${output}`));
    });
  });
  return { child, baseUrl: await ready };
}

async function stopChild(child: ChildProcess | undefined) {
  if (!child || child.killed) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise(resolve => {
      const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        cwd: repoRoot,
        shell: false,
        stdio: "ignore",
      });
      killer.on("exit", resolve);
      killer.on("error", resolve);
    });
  } else {
    child.kill();
  }
  await Promise.race([once(child, "exit"), new Promise(resolve => setTimeout(resolve, 5_000))]);
}

async function verifyUi(page: Page, baseUrl: string, route: string, expectedText: RegExp | string) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForSelector("main", { timeout: 30_000 }).catch(async error => {
    const body = await page.locator("body").innerText({ timeout: 5_000 }).catch(() => "");
    throw new Error(`UI checkpoint failed for ${route}: main not visible. Body excerpt: ${body.slice(0, 1000)}\n${String(error)}`);
  });
  await page.keyboard.press("Tab");
  const body = await page.locator("main").innerText();
  assert(typeof expectedText === "string" ? body.includes(expectedText) : expectedText.test(body), `UI checkpoint failed for ${route}`);
}

async function verifyResponsiveBoardroom(page: Page, baseUrl: string) {
  const viewports = [
    { name: "desktop", width: 1280, height: 720 },
    { name: "presentation", width: 1920, height: 1080 },
    { name: "zoom-200-equivalent", width: 960, height: 540 },
    { name: "mobile", width: 375, height: 812 },
  ];
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/study`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
    await page.waitForSelector("main", { timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 2, `${viewport.name} Boardroom has ${overflow}px global horizontal overflow.`);
    await page.keyboard.press("Tab");
    const hasKeyboardFocus = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active && active !== document.body && active !== document.documentElement);
    });
    assert(hasKeyboardFocus, `${viewport.name} Boardroom did not expose keyboard focus.`);
    for (const chapter of LIVE_DOCUMENT_CHAPTERS) {
      const link = page.locator(`nav a[href="${chapter.href}"]`).first();
      await link.click();
      await page.waitForFunction(expectedHash => window.location.hash === expectedHash, chapter.href);
      assert(await page.locator(chapter.href).count() === 1, `${viewport.name} missing chapter ${chapter.href}.`);
    }
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return { viewports: viewports.length, chaptersPerViewport: LIVE_DOCUMENT_CHAPTERS.length };
}

async function verifyCurrentUiAfterReload(page: Page, expectedPath: string, expectedText: RegExp | string, projectId: string, expectedOpenId: string) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => undefined);
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
  const currentUrl = new URL(page.url());
  assert(currentUrl.pathname === expectedPath, `Reload did not preserve URL. Expected ${expectedPath}, got ${currentUrl.pathname}`);
  await page.waitForSelector("main", { timeout: 30_000 });
  const mainText = await page.locator("main").innerText();
  assert(typeof expectedText === "string" ? mainText.includes(expectedText) : expectedText.test(mainText), `Reloaded UI main content did not match ${expectedPath}`);
  const authProbe = await page.evaluate(async () => {
    const response = await fetch("/api/trpc/auth.me", { credentials: "include" });
    return { status: response.status, body: await response.text() };
  });
  assert(authProbe.status === 200 && authProbe.body.includes(expectedOpenId), "Reloaded browser session did not prove auth.me for expected user.");
  const projectProbe = await page.evaluate(async id => {
    const url = new URL("/api/trpc/igr.projectContext", window.location.origin);
    url.searchParams.set("input", JSON.stringify({ json: { projectId: id } }));
    const response = await fetch(url, { credentials: "include" });
    return { status: response.status, body: await response.text() };
  }, projectId);
  assert(projectProbe.status === 200 && projectProbe.body.includes(projectId), "Reloaded browser session did not prove projectContext for expected project.");
}

function trpcContext(user: Awaited<ReturnType<typeof import("../server/db").getUserByOpenId>>) {
  assert(user, "E2E user was not persisted.");
  return {
    user,
    req: { protocol: "http", headers: {} },
    res: { clearCookie: () => undefined },
  } as never;
}

async function runAdversarialDomainCases() {
  const [
    { calculateFinancialProjection, FinanceDecimal },
    { reconcileCommercialCondition },
    { evaluateProductInventory },
    { calculateCommercialOperations },
    { calculatePointEconomics },
    { buildReceivablesPortfolio },
    { buildPaymentCalendar },
    { runGoalSeek },
  ] = await Promise.all([
    import("../shared/financial/engine"),
    import("../shared/financial/commercialCondition"),
    import("../shared/financial/productInventory"),
    import("../shared/financial/commercialOperations"),
    import("../shared/financial/pointEconomics"),
    import("../shared/financial/receivablesPortfolio"),
    import("../shared/financial/paymentCalendar"),
    import("../shared/financial/goalseek"),
  ]);

  const pendingInputs = baseInputs({ averageTicket: { status: "pending", sourceType: "current_decision", sourceRef } as never });
  assert(calculateFinancialProjection(pendingInputs, 12).status === "blocked_by_pending_inputs", "Pending material input did not block.");
  markCase(1, "engine blocked pending material input");

  assert(reconcileCommercialCondition({
    id: "bad-condition",
    name: "Bad condition",
    listPrice: "100",
    discount: "0",
    entry: { total: "20", installments: 1, firstDueMonth: 0 },
    balance: { principal: "50", installments: 1, graceMonths: 0, firstDueMonth: 1 },
    explicitCharges: "0",
    materialityTolerance: "0.01",
  }).status === "invalid", "Invalid condition reconciled as valid.");
  markCase(2, "commercial condition reconciliation rejected material difference");

  expectThrows(() => calculateFinancialProjection(baseInputs({ paymentBoletoMixRate: provided("0") }), 12), "Payment mix below 100 did not fail.");
  markCase(3, "engine rejected payment mix below 100%");
  expectThrows(() => calculateFinancialProjection(baseInputs({ paymentBoletoMixRate: provided("0.20") }), 12), "Payment mix above 100 did not fail.");
  markCase(4, "engine rejected payment mix above 100%");
  assert(calculateFinancialProjection(baseInputs({ paymentCardViewMdrRate: { status: "pending", sourceType: "current_decision", sourceRef } as never }), 12).status === "blocked_by_pending_inputs", "Pending MDR did not block.");
  markCase(5, "engine blocked pending MDR");

  const exhausted = evaluateProductInventory({ asOfMonth: 0, skus: [{ id: "sold-out", name: "Sold Out", unitType: "UH", unitQuantity: 1, sharesPerUnit: 2, grossSoldShares: 2, returnedShares: 0, blockedShares: 0, pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100" }] }] });
  assert(exhausted.totals.availableShares === 0, "Sold-out inventory was not exhausted.");
  markCase(6, "inventory reached zero available shares");
  assert(evaluateProductInventory({ asOfMonth: 0, skus: [{ id: "bad-stock", name: "Bad Stock", unitType: "UH", unitQuantity: 1, sharesPerUnit: 2, grossSoldShares: 3, returnedShares: 0, blockedShares: 0, pricePhases: [{ id: "launch", startsAtMonth: 0, price: "100" }] }] }).status === "invalid", "Sales above stock did not fail.");
  markCase(7, "inventory rejected sales above stock");

  const operations = calculateCommercialOperations({ horizonMonths: 3, pointDemand: { toursMonthly: "1000", salesMonthly: "100" }, definition: {
    room: { rooms: [{ roomId: "small", tables: "1", overflowTables: "0" }], operatingDaysPerMonth: "20", operatingHoursPerDay: "4", shifts: "1", averageTourDurationMinutes: "60", toursPerTable: "1", receptionists: "1", receptionCapacityPerPerson: "50", consultants: "1", consultantCapacityPerPerson: "40", closers: "1", closerSalesCapacityPerPerson: "5", peakFlowFactor: "2", maxWaitMinutes: "5" },
    workforce: { cashflowTreatment: "incremental", cohorts: [
      { cohortId: "consultants", role: "consultant", capacityUnit: "tours", headcount: "1", hireMonth: 0, trainingMonths: 1, certificationRate: "0.5", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "0.5" }], matureProductivity: "40", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "1000", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
      { cohortId: "closers", role: "closer", capacityUnit: "sales", headcount: "1", hireMonth: 0, trainingMonths: 1, certificationRate: "0.5", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "0.5" }], matureProductivity: "5", absenteeismRate: "0", monthlyTurnoverRate: "0", fixedCompensation: "1000", burden: "0", guarantee: "0", allowance: "0", replacementCost: "0" },
    ] },
    training: { cashflowTreatment: "incremental", plans: [{ trainingId: "academy", role: "closer", startMonth: 0, candidates: "0", classes: "1", durationMonths: 1, trainers: "1", trainerMonthlyCost: "100", candidateMonthlySalary: "0", monthlySupportCost: "0", approvalRate: "1", certificationRate: "1", timeToProductiveMonths: 1, targetProductivePeople: "2" }] },
    commissions: { cashflowTreatment: "incremental", policies: [] },
  } });
  assert(operations.room.alerts.some(alert => alert.code === "tour_capacity_exceeded"), "Room bottleneck missing.");
  markCase(8, "room capacity emitted tour bottleneck");
  assert(operations.room.alerts.some(alert => alert.code === "closer_capacity_exceeded"), "Workforce/closer bottleneck missing.");
  markCase(9, "commercial operations emitted closer bottleneck");
  assert(Number(operations.training[0]?.summary.targetGap) > 0, "Training gap missing.");
  markCase(10, "training economics emitted productive people gap");

  const point = calculatePointEconomics({ points: [{ pointId: "loss", name: "Loss Point", channel: "Mall", activationCost: "10000", monthlyFixedCost: "5000", costPerSale: "100", approaches: "100", researchRate: "0.5", qualificationRate: "0.5", invitationRate: "0.5", appointmentRate: "0.5", showRate: "0.5", tourRate: "0.5", saleRate: "0.01", averageTicket: "100", averageEntry: "10", contributionMarginRate: "0.1", healthyD90Rate: "0.8", cannibalizationRate: "0", cashflowTreatment: "incremental" }] });
  assert(point.points[0]?.classification === "KILL", "Loss point was not classified as KILL.");
  markCase(11, "point economics classified below break-even point as KILL");

  const cohort = { cohortId: "jan", saleMonth: 0, contracts: "10", paymentSchedulePerContract: [{ component: "entry" as const, dueMonthOffset: 0, grossAmount: "100" }] };
  assert(buildReceivablesPortfolio({ cohorts: [cohort], policy: { cancellationCurve: { d7: "0", d30: "0", d60: "0", d90: "0", d180: "0", lifetime: "0" }, delinquencyRate: "0", cureRates: { days1To30: "0", days31To60: "0", days61To90: "0", days90Plus: "0" }, writeOffAfterDays: 180, policyVersion: "zero", sourceRef }, asOfMonth: 4 }).cohortSummaries[0]?.healthyD90 === "10.00000000", "Zero cancellation case failed.");
  markCase(12, "portfolio kept all contracts healthy with zero cancellation/delinquency");
  assert(buildReceivablesPortfolio({ cohorts: [cohort], policy: { cancellationCurve: { d7: "0.1", d30: "0.2", d60: "0.4", d90: "0.9", d180: "0.95", lifetime: "1" }, delinquencyRate: "0", cureRates: { days1To30: "0", days31To60: "0", days61To90: "0", days90Plus: "0" }, writeOffAfterDays: 180, policyVersion: "extreme", sourceRef }, asOfMonth: 4 }).cohortSummaries[0]?.activeD90 === "1.00000000", "Extreme cancellation case failed.");
  markCase(13, "portfolio applied extreme cancellation curve");
  assert(buildReceivablesPortfolio({ cohorts: [cohort], policy: { cancellationCurve: { d7: "0", d30: "0", d60: "0", d90: "0", d180: "0", lifetime: "0" }, delinquencyRate: "1", cureRates: { days1To30: "0", days31To60: "0", days61To90: "0", days90Plus: "0" }, writeOffAfterDays: 90, policyVersion: "delinquent", sourceRef }, asOfMonth: 3 }).ledger[0]?.agingStatus === "written_off", "Extreme delinquency case failed.");
  markCase(14, "portfolio wrote off unresolved extreme delinquency");
  assert(Number(buildReceivablesPortfolio({ cohorts: [cohort], policy: { cancellationCurve: { d7: "0", d30: "0", d60: "0", d90: "0", d180: "0", lifetime: "0" }, delinquencyRate: "1", cureRates: { days1To30: "0.5", days31To60: "0.5", days61To90: "0.5", days90Plus: "0" }, writeOffAfterDays: 180, policyVersion: "cure", sourceRef }, asOfMonth: 3 }).monthlySummaries[1]?.curedCollections) > 0, "Cure case failed.");
  markCase(15, "portfolio recorded cure collections");

  assert(buildPaymentCalendar({ id: "delayed", name: "Delayed", listPrice: "1000", discount: "0", entry: { total: "1000", installments: 1, firstDueMonth: 2 }, balance: { principal: "0", installments: 1, graceMonths: 0, firstDueMonth: 0 }, explicitCharges: "0", materialityTolerance: "0.01" }).lines[0]?.dueMonthOffset === 2, "Delayed settlement/calendar case failed.");
  markCase(16, "payment calendar preserved delayed due month");
  assert(calculateFinancialProjection(baseInputs({ qualifiedCouplesMonth1: provided("0") }), 12).kpis.grossSales === "0.00000000", "No sales case failed.");
  markCase(17, "engine produced zero gross sales without NaN");
  assert(exhausted.totals.selloutRate === "1.00000000", "Early sellout case failed.");
  markCase(18, "inventory produced sellout rate 100%");

  assert(runGoalSeek({ variableKey: "conversionRate", target: "999", lowerBound: "0", upperBound: "1", evaluate: candidate => candidate }).status === "unreachable", "Unreachable goal seek failed.");
  markCase(19, "goal seek returned unreachable");
  assert(runGoalSeek({ variableKey: "conversionRate", target: "0.9", lowerBound: "0", upperBound: "1", maxIterations: 1, evaluate: candidate => candidate }).status === "iteration_limit", "Iteration limit goal seek failed.");
  markCase(20, "goal seek returned iteration_limit");
  let evaluated = false;
  try {
    runGoalSeek({ variableKey: "conversionRate", target: "1", lowerBound: "2", upperBound: "1", evaluate: candidate => {
      evaluated = true;
      return candidate;
    } });
  } catch {
    markCase(21, "goal seek rejected invalid bounds before evaluation");
  }
  assert(!evaluated, "Invalid bounds still evaluated.");
  assert(calculateFinancialProjection(baseInputs(), 120).projections.length === 120, "Large horizon failed.");
  markCase(27, "engine calculated 120-month horizon");
  assert(new FinanceDecimal("1").toFixed(8) === "1.00000000", "Decimal sanity failed.");
}

async function main() {
  console.log("MASTER_AUTHENTICATED_E2E: hybrid browser/API runner");
  console.log("Hybrid policy: UI is used for login/session, navigation and checkpoints; tRPC is used for domain setup where no complete click-only editor exists.");

  const tempRoot = await mkdtemp(path.join(tmpdir(), "tgr-e2e-master-"));
  await mkdir(path.join(tempRoot, "screenshots"), { recursive: true });
  const forge = await startLocalForge();
  const env = {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(appPort),
    DATABASE_URL: databaseUrl,
    TGR_INTEGRATION_DB_PORT: String(dbPort),
    TGR_DISABLE_MANUS_DEVTOOLS: "true",
    VITE_APP_ID: "tgr-master-e2e",
    OWNER_OPEN_ID: ownerOpenId,
    JWT_SECRET: jwtSecret,
    OAUTH_SERVER_URL: "http://127.0.0.1/e2e-oauth-not-used",
    BUILT_IN_FORGE_API_URL: forge.baseUrl,
    BUILT_IN_FORGE_API_KEY: "local-e2e-forge-key",
  };
  Object.assign(process.env, env);

  let app: { child: ChildProcess; baseUrl: string } | undefined;
  let browser: Browser | undefined;
  try {
    await run("docker", ["compose", "-f", "docker-compose.integration.yml", "down", "--remove-orphans"], env);
    await run("docker", ["compose", "-f", "docker-compose.integration.yml", "up", "-d", "--wait", "--wait-timeout", "120"], env);
    await run("pnpm", ["exec", "drizzle-kit", "migrate"], env);

    const [{ upsertUser, getUserByOpenId }, { sdk }, { appRouter }] = await Promise.all([
      import("../server/db"),
      import("../server/_core/sdk"),
      import("../server/routers"),
    ]);
    await upsertUser({
      openId: ownerOpenId,
      name: ownerName,
      email: "tgr-master-e2e@test.local",
      loginMethod: "e2e",
      role: "admin",
      lastSignedIn: new Date(),
    });
    const user = await getUserByOpenId(ownerOpenId);
    const caller = appRouter.createCaller(trpcContext(user));

    app = await startApp(env);
    const executablePath = findBrowserExecutable();
    assert(executablePath, "No Chromium/Edge executable found. Set CHROMIUM_PATH.");
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const token = await sdk.createSessionToken(ownerOpenId, { name: ownerName, expiresInMs: 15 * 60 * 1000 });
    await page.context().addCookies([{ name: COOKIE_NAME, value: token, url: app.baseUrl, httpOnly: true, secure: false, sameSite: "Lax" }]);

    await verifyUi(page, app.baseUrl, "/builder", /Montagem|Produto|Condição/i);
    await page.screenshot({ path: path.join(tempRoot, "screenshots", "01-builder-authenticated.png"), fullPage: true });

    const created = await caller.igr.createProject({ name: `TGR Master E2E ${Date.now()}`, inputs: baseInputs() });
    const versionId = created.versionId;
    const projectId = created.projectId;
    await caller.igr.upsertBuilderComponent({ versionId, componentType: "project_assembly", name: "Premissas mestre", status: "provided", payload: { praca: "Cotia", horizonte: "24", origem: "E2E hibrido" }, sourceType: "current_decision", sourceRef });
    await caller.igr.saveCommercialModel({
      versionId,
      asOfMonth: 0,
      skus: [{ id: "cotia-2q", name: "Cotia 2Q", unitType: "2Q", unitQuantity: 20, sharesPerUnit: 4, grossSoldShares: 0, returnedShares: 0, blockedShares: 0, status: "provided", sourceType: "current_document", sourceRef, pricePhases: [{ id: "launch", startsAtMonth: 0, price: "110000" }] }],
      conditions: [{ productSkuCode: "cotia-2q", status: "provided", sourceType: "current_document", sourceRef, condition: { id: "standard", name: "Condicao padrao", listPrice: "110000", discount: "0", entry: { total: "20000", installments: 4, firstDueMonth: 0 }, balance: { principal: "89000", installments: 48, graceMonths: 1, firstDueMonth: 2 }, explicitCharges: "1000", explicitChargesDueMonth: 7, materialityTolerance: "0.01" } }],
    });
    await caller.igr.replaceCapturePoints({ versionId, points: [{ status: "provided", sourceType: "current_document", sourceRef, definition: { pointId: "mall-cotia", name: "Mall Cotia", channel: "Shopping", activationCost: "12000", monthlyFixedCost: "4000", costPerSale: "250", approaches: "1000", researchRate: "0.5", qualificationRate: "0.4", invitationRate: "0.8", appointmentRate: "0.75", showRate: "0.8", tourRate: "0.5", saleRate: "0.2", cannibalizationRate: "0.1", cashflowTreatment: "incremental" } }] });
    await caller.igr.upsertCommercialOperations({ versionId, status: "provided", sourceType: "current_document", sourceRef, definition: {
      room: { rooms: [{ roomId: "main", tables: "8", overflowTables: "2" }], operatingDaysPerMonth: "22", operatingHoursPerDay: "8", shifts: "2", averageTourDurationMinutes: "60", toursPerTable: "1", receptionists: "3", receptionCapacityPerPerson: "220", consultants: "6", consultantCapacityPerPerson: "120", closers: "4", closerSalesCapacityPerPerson: "30", peakFlowFactor: "1.4", maxWaitMinutes: "15" },
      workforce: { cashflowTreatment: "incremental", cohorts: [
        { cohortId: "consultants", role: "consultant", capacityUnit: "tours", headcount: "6", hireMonth: 0, trainingMonths: 1, certificationRate: "0.95", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "0.7" }, { productiveAgeMonth: 1, productivityRate: "1" }], matureProductivity: "120", absenteeismRate: "0.05", monthlyTurnoverRate: "0.02", fixedCompensation: "2800", burden: "1000", guarantee: "300", allowance: "300", replacementCost: "800" },
        { cohortId: "closers", role: "closer", capacityUnit: "sales", headcount: "4", hireMonth: 0, trainingMonths: 1, certificationRate: "0.9", rampCurve: [{ productiveAgeMonth: 0, productivityRate: "0.7" }, { productiveAgeMonth: 1, productivityRate: "1" }], matureProductivity: "30", absenteeismRate: "0.05", monthlyTurnoverRate: "0.02", fixedCompensation: "3500", burden: "1200", guarantee: "500", allowance: "300", replacementCost: "1000" },
      ] },
      training: { cashflowTreatment: "incremental", plans: [{ trainingId: "academy", role: "closer", startMonth: 0, candidates: "8", classes: "1", durationMonths: 1, trainers: "1", trainerMonthlyCost: "5000", candidateMonthlySalary: "1500", monthlySupportCost: "1000", approvalRate: "0.9", certificationRate: "0.9", timeToProductiveMonths: 1, targetProductivePeople: "4" }] },
      commissions: { cashflowTreatment: "incremental", policies: [{ policyId: "closer-fixed", role: "closer", eligibleBase: "gross_sales", mode: "percentage", fixedAmount: "0", percentageRate: "0.02", tiers: [], guarantee: "0", cutoffDay: 15, paymentLagMonths: 1, qualityMultiplier: "1", holdbackRate: "0", reversalEnabled: false }] },
    } });
    await caller.igr.createCostCatalogItem({ versionId, category: "operations", name: "Operacao comercial Cotia", frequency: "monthly", amountText: "12000", status: "provided", sourceType: "current_document", sourceRef });
    await caller.igr.upsertReceivablesPolicy({ versionId, status: "provided", sourceType: "current_document", sourceRef, policy: { cancellationCurve: { d7: "0.01", d30: "0.02", d60: "0.03", d90: "0.04", d180: "0.05", lifetime: "0.06" }, delinquencyRate: "0.08", cureRates: { days1To30: "0.40", days31To60: "0.30", days61To90: "0.20", days90Plus: "0.10" }, writeOffAfterDays: 180, policyVersion: "e2e-policy-v1", sourceRef } });
    await caller.igr.createDecision({ versionId, title: "Aprovar baseline E2E", decisionValue: "baseline", rationale: "Jornada mestre criou dados reais e está pronta para snapshot autoritativo.", responsible: ownerName, sourceRef });

    const snapshot = await caller.igr.calculate({ versionId, horizonMonths: 24, asOfMonth: 0 });
    assert(snapshot.status === "valid", `Snapshot not valid: ${snapshot.status}`);
    assert(snapshot.receivablesPortfolio, "Cohorts/portfolio were not generated.");
    assert(snapshot.kpis.totalOperatingCashFlow, "Cash KPI missing.");
    const capital = await caller.igr.capitalEnvelope({ versionId, horizonMonths: 24, asOfMonth: 0, availableCapital: "500000" });
    assert(capital.requiredCapital, "Capital envelope missing.");
    const scenario = await caller.igr.createScenario({ baseVersionId: versionId, name: "E2E Goal Seek", reason: "Master E2E scenario branch" });
    const goalTarget = snapshot.kpis.healthyD90;
    assert(goalTarget, "Healthy D90 KPI missing for Goal Seek target.");
    const goal = await caller.igr.goalSeek({ versionId, horizonMonths: 24, asOfMonth: 0, targetKpi: "healthyD90", variableKey: "qualifiedCouplesMonth1", target: goalTarget, lowerBound: "1", upperBound: "250" });
    assert(goal.status === "converged" && goal.result, `Goal Seek did not converge: ${JSON.stringify(goal)}`);
    await caller.igr.applyGoalSeek({ targetVersionId: scenario.versionId, sourceVersionId: versionId, horizonMonths: 24, asOfMonth: 0, variableKey: "qualifiedCouplesMonth1", value: goal.result, targetKpi: "healthyD90", target: goalTarget, lowerBound: "1", upperBound: "250", objectiveValue: goal.objectiveValue, residual: goal.residual, iterations: goal.iterations });
    const scenarioSnapshot = await caller.igr.calculate({ versionId: scenario.versionId, horizonMonths: 24, asOfMonth: 0 });
    assert(scenarioSnapshot.status === "valid", "Goal Seek scenario snapshot was not valid.");
    const mismatchedScenarioSnapshot = await caller.igr.calculate({
      versionId: scenario.versionId,
      horizonMonths: 12,
      asOfMonth: 1,
    });
    assert(
      mismatchedScenarioSnapshot.status === "valid",
      "Mismatched analytical-window scenario snapshot was not valid."
    );
    await verifyUi(page, app.baseUrl, "/scenarios", /Goal Seek|Cenario|Cenário/i);
    await verifyUi(page, app.baseUrl, "/study", /Boardroom|Capital|Decis/i);
    await page.screenshot({ path: path.join(tempRoot, "screenshots", "02-boardroom-before-approval.png"), fullPage: true });

    const approval = await caller.igr.approveSnapshot({ snapshotId: snapshot.id, rationale: "Master authenticated E2E approval." });
    assert(approval.approved, "Approval failed.");
    const baseline = await caller.igr.freezeBaseline({ snapshotId: snapshot.id });
    assert(baseline.baseline, "Baseline freeze failed.");
    const pdf = await caller.igr.requestExport({ snapshotId: snapshot.id, format: "pdf" });
    const pptx = await caller.igr.requestExport({ snapshotId: snapshot.id, format: "pptx" });
    const xlsx = await caller.igr.requestExport({ snapshotId: snapshot.id, format: "xlsx" });
    assert(pdf.exportPackHash === pptx.exportPackHash && pptx.exportPackHash === xlsx.exportPackHash, "Export formats did not share one deterministic pack hash.");
    assert(xlsx.exportPackHash !== snapshot.snapshotHash, "Scenario-aware export pack hash did not differ from the base snapshot hash.");
    const exportBytes = [pdf, pptx, xlsx].map(item => {
      const key = item.url.replace(/^\/manus-storage\//, "");
      return storage.get(key)?.byteLength ?? 0;
    });
    assert(exportBytes.every(size => size > 500), `Export bytes too small: ${exportBytes.join(", ")}`);
    const xlsxKey = xlsx.url.replace(/^\/manus-storage\//, "");
    const xlsxBuffer = storage.get(xlsxKey);
    assert(xlsxBuffer, "Scenario-aware XLSX was not stored.");
    const xlsxArchive = await JSZip.loadAsync(xlsxBuffer);
    const scenariosXml = await xlsxArchive.file("xl/worksheets/sheet4.xml")?.async("string");
    assert(scenariosXml?.includes("E2E Goal Seek"), "Investor Pack XLSX did not contain the persisted scenario comparison.");
    assert(
      scenariosXml?.includes(scenarioSnapshot.snapshotHash),
      "Investor Pack XLSX did not select the scenario snapshot with the base analytical window."
    );
    assert(
      !scenariosXml?.includes(mismatchedScenarioSnapshot.snapshotHash),
      "Investor Pack XLSX mixed a scenario snapshot from another horizon/data-base."
    );
    const responsiveBoardroom = await verifyResponsiveBoardroom(page, app.baseUrl);

    await page.reload({ waitUntil: "domcontentloaded" });
    await verifyCurrentUiAfterReload(page, "/study", /Boardroom|Baseline|Snapshot/i, projectId, ownerOpenId);
    markCase(30, "browser reload preserved URL, main content, authenticated session and project context");
    await verifyUi(page, app.baseUrl, "/builder", /Montagem|Produto|Condição/i);
    await page.getByRole("button", { name: /abrir menu da conta/i }).click();
    await page.getByRole("menuitem", { name: /sair/i }).click();
    await page.waitForTimeout(500);
    await page.context().clearCookies();
    const freshLocalTestToken = await sdk.createSessionToken(ownerOpenId, { name: ownerName, expiresInMs: 15 * 60 * 1000 });
    await page.context().addCookies([{ name: COOKIE_NAME, value: freshLocalTestToken, url: app.baseUrl, httpOnly: true, secure: false, sameSite: "Lax" }]);
    await verifyUi(page, app.baseUrl, "/study", /Boardroom|Baseline|Snapshot/i);
    markCase(29, "logout followed by session restoration with fresh local test token reopened authenticated state with same project available");
    const reopened = await caller.igr.projectContext({ projectId });
    assert(reopened.project.status === "baseline", "Reopened project did not persist baseline state.");

    await runAdversarialDomainCases();
    await caller.igr.approveSnapshot({ snapshotId: snapshot.id, rationale: "Repeated approval must be idempotent." });
    await caller.igr.freezeBaseline({ snapshotId: snapshot.id });
    markCase(28, "approval and baseline repeated idempotently");
    const outsider = appRouter.createCaller({
      user: { ...user!, id: user!.id + 991, openId: "tgr-outsider", role: "admin" },
      req: { protocol: "http", headers: {} },
      res: { clearCookie: () => undefined },
    } as never);
    await outsider.igr.project({ projectId }).then(
      () => { throw new Error("Cross-tenant project access succeeded."); },
      () => markCase(23, "cross-tenant project access rejected"),
    );
    await outsider.igr.requestExport({ snapshotId: snapshot.id, format: "pdf" }).then(
      () => { throw new Error("Unauthorized cross-tenant export succeeded."); },
      () => markCase(24, "cross-tenant export authority rejected"),
    );
    await caller.igr.requestExport({ snapshotId: "missing-snapshot", format: "pdf" }).then(
      () => { throw new Error("Export from invalid temporary simulation succeeded."); },
      () => markCase(25, "export rejected invalid/non-approved simulation snapshot"),
    );
    await caller.igr.createCostCatalogItem({ versionId, category: "operations", name: "bad", frequency: "monthly", amountText: "not-a-decimal", status: "provided", sourceType: "current_document", sourceRef }).then(
      () => { throw new Error("Corrupted input was accepted."); },
      () => markCase(26, "API rejected corrupted decimal input"),
    );
    await caller.igr.updateInputs({ versionId, inputs: baseInputs({ averageTicket: provided("120000") }) }).then(
      () => { throw new Error("Baseline mutation succeeded."); },
      () => markCase(22, "baseline mutation rejected after freeze"),
    );

    assertCaseManifestComplete();
    console.log(JSON.stringify({
      status: "PASS",
      hybrid: true,
      appUrl: app.baseUrl,
      projectId,
      versionId,
      snapshotId: snapshot.id,
      snapshotHash: snapshot.snapshotHash,
      scenarioSnapshotHash: scenarioSnapshot.snapshotHash,
      excludedMismatchedScenarioSnapshotHash: mismatchedScenarioSnapshot.snapshotHash,
      exportPackHash: xlsx.exportPackHash,
      exports: { pdfBytes: exportBytes[0], pptxBytes: exportBytes[1], xlsxBytes: exportBytes[2] },
      responsiveBoardroom,
      artifacts: tempRoot,
      adversarialCases,
    }, null, 2));
  } finally {
    await browser?.close();
    await stopChild(app?.child);
    forge.server.close();
    await run("docker", ["compose", "-f", "docker-compose.integration.yml", "down", "--remove-orphans"], env).catch(error => {
      console.warn(String(error));
    });
  }
}

main().catch(error => {
  console.error("MASTER_AUTHENTICATED_E2E_FAIL");
  console.error(error);
  process.exit(1);
});
