import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const baseUrl = process.env.STAGING_URL?.replace(/\/$/, "");
const username = process.env.STAGING_AUTH_USERNAME;
const password = process.env.STAGING_AUTH_PASSWORD;
const expectedGitSha = process.env.EXPECTED_GIT_SHA;
const screenshotDir = process.env.STAGING_SCREENSHOT_DIR;

assert(baseUrl?.startsWith("https://"), "STAGING_URL HTTPS é obrigatória.");
assert(username, "STAGING_AUTH_USERNAME é obrigatório.");
assert(password, "STAGING_AUTH_PASSWORD é obrigatório.");

function browserExecutable() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ];
  return candidates.find(candidate => candidate && existsSync(candidate));
}

async function waitForHealth() {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      lastStatus = response.status;
      if (response.ok) {
        const health = await response.json() as {
          ok: boolean;
          environment: string;
          version: string;
          gitSha: string;
          database: string;
        };
        assert.equal(health.ok, true);
        assert.equal(health.environment, "staging");
        assert.equal(health.database, "up");
        if (expectedGitSha) assert.equal(health.gitSha, expectedGitSha);
        return health;
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 2_000));
  }
  throw new Error(`Health de staging não ficou pronto; último status ${lastStatus}.`);
}

const executablePath = browserExecutable();
assert(executablePath, "Chromium/Chrome/Edge não encontrado para QA de staging.");
const health = await waitForHealth();
const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Entrar no Boardroom" }).click();
  await page.waitForURL(`${baseUrl}/login`, { timeout: 30_000 });
  await page.getByLabel("Usuário").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar com segurança" }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
  await page.getByText(/Montagem|Produto|Condição/i).first().waitFor({ timeout: 30_000 });

  const viewports = [
    { name: "desktop-1440", width: 1440, height: 900 },
    { name: "desktop-1920", width: 1920, height: 1080 },
    { name: "tablet", width: 1024, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ];
  if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(`${baseUrl}/builder`, { waitUntil: "domcontentloaded" });
    await page.getByText(/Montagem|Produto|Condição/i).first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 2, `${viewport.name}: Builder com ${overflow}px de overflow global.`);
    if (screenshotDir)
      await page.screenshot({ path: path.join(screenshotDir, `${viewport.name}-builder.png`), fullPage: true });
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${baseUrl}/study`, { waitUntil: "domcontentloaded" });
  const selector = page.locator("#tgr-project");
  await selector.waitFor({ timeout: 30_000 });
  await selector.selectOption({ label: "Projeto Único Ponta Negra" });
  await page.getByText("MODELO FINANCEIRO — HARMONY COMPAT V1", { exact: true }).waitFor({ timeout: 30_000 });
  await page.getByText(/GOLDEN HARMONY CANÔNICO · Reconciliação certificada/i).waitFor();
  await page.getByText(/1 conflito de fonte · ver evidências/i).waitFor();
  await page.getByText(/Baseline congelada e protegida/i).waitFor();

  await page.locator("#meta-vendas-brutas").fill("120");
  await page.getByRole("button", { name: "Recalcular agora" }).click();
  await page.getByText("HIPÓTESE · MODELO FINANCEIRO — HARMONY COMPAT V1", { exact: true }).waitFor({ timeout: 30_000 });
  const salesRow = page.getByRole("row").filter({ hasText: "Vendas brutas · mês 1" });
  const salesCells = await salesRow.locator("td").allInnerTexts();
  assert(salesCells.some(value => /100/.test(value)) && salesCells.some(value => /120/.test(value)), "Boardroom não mostrou delta 100 → 120.");

  const exports = [
    { button: "Exportar estudo em PDF", minimumBytes: 500 },
    { button: "Exportar apresentação", minimumBytes: 500 },
    { button: "Exportar memória em XLSX", minimumBytes: 500 },
  ];
  const exportResults: Array<{ label: string; status: number; bytes: number }> = [];
  for (const item of exports) {
    await page.getByRole("button", { name: item.button }).click();
    const link = page.getByRole("link", { name: /Abrir artefato/i });
    await link.waitFor({ timeout: 30_000 });
    const href = await link.getAttribute("href");
    assert(href, `${item.button}: URL do artefato ausente.`);
    const response = await context.request.get(new URL(href, baseUrl).toString());
    const bytes = (await response.body()).byteLength;
    assert(response.ok(), `${item.button}: download retornou ${response.status()}.`);
    assert(bytes > item.minimumBytes, `${item.button}: artefato muito pequeno (${bytes} bytes).`);
    exportResults.push({ label: item.button, status: response.status(), bytes });
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("MODELO FINANCEIRO — HARMONY COMPAT V1", { exact: true }).waitFor({ timeout: 30_000 });
  await page.goto(`${baseUrl}/scenarios`, { waitUntil: "domcontentloaded" });
  await page.getByText(/Harmony R\$35 mil/i).waitFor({ timeout: 30_000 });
  await page.getByText(/Harmony R\$40 mil/i).waitFor();

  await page.goto(`${baseUrl}/builder`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Abrir menu da conta/i }).click();
  await page.getByRole("menuitem", { name: /Sair/i }).click();
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Entrar no Boardroom" }).click();
  await page.waitForURL(`${baseUrl}/login`, { timeout: 30_000 });
  await page.getByLabel("Usuário").fill(username);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar com segurança" }).click();
  await page.waitForURL(`${baseUrl}/`, { timeout: 30_000 });
  await page.goto(`${baseUrl}/study`, { waitUntil: "domcontentloaded" });
  await page.locator("#tgr-project").selectOption({ label: "Projeto Único Ponta Negra" });
  await page.getByText(/Baseline congelada e protegida/i).waitFor({ timeout: 30_000 });

  console.log(JSON.stringify({
    status: "PASS",
    url: baseUrl,
    health,
    harmony: "HARMONY_COMPAT_V1",
    sourceConflict: "SC-001",
    boardroom: "100_TO_120_PASS",
    exports: exportResults,
    qa: viewports.map(viewport => viewport.name),
    persistence: "LOGOUT_LOGIN_PASS",
  }));
} finally {
  await browser.close();
}
