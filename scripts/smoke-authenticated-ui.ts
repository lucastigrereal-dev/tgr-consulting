import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "../server/_core/sdk";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const openId = process.env.OWNER_OPEN_ID;
const ownerName = process.env.OWNER_NAME ?? "IGR Smoke Owner";
const screenshotDir = process.env.SMOKE_SCREENSHOT_DIR;
const routes = ["/", "/builder", "/study", "/costs", "/decisions", "/scenarios", "/governance"];
const chapterLinks = [
  { name: "Montagem", expectedPath: "/builder", expectedHash: "" },
  { name: "Premissas", expectedPath: "/study", expectedHash: "#study-assumptions" },
  { name: "Produto", expectedPath: "/study", expectedHash: "#study-product" },
  { name: "Vendas", expectedPath: "/study", expectedHash: "#study-sales" },
  { name: "Receita", expectedPath: "/study", expectedHash: "#study-revenue" },
  { name: "Custos", expectedPath: "/study", expectedHash: "#study-costs" },
  { name: "Operação", expectedPath: "/study", expectedHash: "#study-operation" },
  { name: "Caixa", expectedPath: "/study", expectedHash: "#study-cashflow" },
  { name: "Cenários", expectedPath: "/study", expectedHash: "#study-scenarios" },
  { name: "Indicadores", expectedPath: "/study", expectedHash: "#study-impact" },
  { name: "Conclusão", expectedPath: "/study", expectedHash: "#study-conclusion" },
];
const viewports = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "presentation", width: 1920, height: 1080 },
  { name: "presentation-zoom-200", width: 960, height: 540 },
  { name: "mobile", width: 375, height: 812 },
];

if (!openId) throw new Error("OWNER_OPEN_ID é obrigatório para o smoke autenticado.");
if (screenshotDir) await mkdir(screenshotDir, { recursive: true });
const token = await sdk.createSessionToken(openId, { name: ownerName, expiresInMs: 5 * 60 * 1000 });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const context = await browser.newContext();
  await context.addCookies([{ name: COOKIE_NAME, value: token, url: baseUrl, httpOnly: true, secure: false, sameSite: "Lax" }]);
  for (const viewport of viewports) {
    const page = await context.newPage();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const consoleErrors: string[] = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    for (const route of routes) {
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`${viewport.name} ${route}: resposta HTTP inválida`);
      await page.waitForSelector("main", { timeout: 10_000 });
      if (await page.getByRole("button", { name: "Entrar no Boardroom" }).count()) throw new Error(`${viewport.name} ${route}: sessão não foi aceita`);
      const mainText = (await page.locator("main").innerText()).trim();
      if (!mainText) throw new Error(`${viewport.name} ${route}: conteúdo autenticado vazio`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) throw new Error(`${viewport.name} ${route}: overflow horizontal de ${overflow}px`);
      await page.keyboard.press("Tab");
      const keyboardFocus = await page.evaluate(() => {
        const active = document.activeElement;
        return Boolean(active && active !== document.body && active !== document.documentElement);
      });
      if (!keyboardFocus) throw new Error(`${viewport.name} ${route}: navegação por teclado não produziu foco visível`);
      if (screenshotDir && route === "/study" && viewport.name !== "mobile") {
        await page.screenshot({
          path: path.join(screenshotDir, `boardroom-${viewport.name}.png`),
          fullPage: true,
        });
      }
      console.log(`✓ ${viewport.name} ${route} (autenticado)`);
    }
    for (const chapter of chapterLinks) {
      await page.goto(`${baseUrl}/study`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.locator("nav a").filter({ hasText: chapter.name }).click();
      await page.waitForURL(
        url => url.pathname === chapter.expectedPath && url.hash === chapter.expectedHash,
        { timeout: 10_000 }
      );
      await page.waitForSelector("main", { timeout: 10_000 });
      const mainText = (await page.locator("main").innerText()).trim();
      if (!mainText) throw new Error(`${viewport.name} capítulo ${chapter.name}: conteúdo vazio`);
      console.log(`✓ ${viewport.name} capítulo ${chapter.name}`);
    }
    if (consoleErrors.length) throw new Error(`${viewport.name}: console.error detectado: ${consoleErrors.join(" | ")}`);
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
}
