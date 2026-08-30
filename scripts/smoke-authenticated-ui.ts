import { chromium } from "playwright-core";
import { COOKIE_NAME } from "../shared/const";
import { sdk } from "../server/_core/sdk";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const openId = process.env.OWNER_OPEN_ID;
const ownerName = process.env.OWNER_NAME ?? "IGR Smoke Owner";
const routes = ["/", "/builder", "/costs", "/decisions", "/scenarios", "/governance"];
const chapterLinks = [
  { name: "Abrir produto", expectedPath: "/builder" },
  { name: "Abrir comercial", expectedPath: "/builder" },
  { name: "Abrir operação", expectedPath: "/builder" },
  { name: "Abrir financeiro", expectedPath: "/costs" },
  { name: "Abrir decisão", expectedPath: "/scenarios" },
];
const viewports = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 375, height: 812 },
];

if (!openId) throw new Error("OWNER_OPEN_ID é obrigatório para o smoke autenticado.");
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
      await page.waitForSelector("main h1", { timeout: 10_000 });
      if (await page.getByRole("button", { name: "Entrar no Boardroom" }).count()) throw new Error(`${viewport.name} ${route}: sessão não foi aceita`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) throw new Error(`${viewport.name} ${route}: overflow horizontal de ${overflow}px`);
      console.log(`✓ ${viewport.name} ${route} (autenticado)`);
    }
    for (const chapter of chapterLinks) {
      await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 30_000 });
      await page.getByRole("link", { name: chapter.name }).click();
      await page.waitForURL((url) => url.pathname === chapter.expectedPath, { timeout: 10_000 });
      await page.waitForSelector("main h1", { timeout: 10_000 });
      console.log(`✓ ${viewport.name} capítulo ${chapter.name}`);
    }
    if (consoleErrors.length) throw new Error(`${viewport.name}: console.error detectado: ${consoleErrors.join(" | ")}`);
    await page.close();
  }
  await context.close();
} finally {
  await browser.close();
}
