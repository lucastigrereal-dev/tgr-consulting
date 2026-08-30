import { chromium } from "playwright-core";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";
const routes = ["/", "/builder", "/study", "/costs", "/decisions", "/scenarios", "/governance"];
const viewports = [
  { name: "desktop", width: 1280, height: 720 },
  { name: "mobile", width: 375, height: 812 },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    for (const route of routes) {
      const requestedModules = [];
      const requestListener = request => {
        if (request.resourceType() === "script") requestedModules.push(request.url());
      };
      page.on("request", requestListener);
      const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle", timeout: 30_000 });
      if (!response || response.status() >= 400) throw new Error(`${viewport.name} ${route}: resposta HTTP inválida`);
      await page.waitForSelector("main, button", { timeout: 10_000 });
      const loginGate = await page.getByRole("button", { name: "Entrar no Boardroom" }).count();
      if (!loginGate) {
        await page.waitForSelector("main", { timeout: 10_000 });
        const headingCount = await page.locator("h1").count();
        if (headingCount < 1) throw new Error(`${viewport.name} ${route}: painel autenticado sem título principal`);
      }
      if (!loginGate && (route === "/" || route === "/builder" || route === "/study")) {
        const expectedChunk = route === "/study" ? /Boardroom/i : /Builder/i;
        if (!requestedModules.some(url => expectedChunk.test(url))) {
          throw new Error(`${viewport.name} ${route}: chunk lazy esperado não foi requisitado`);
        }
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (overflow > 2) throw new Error(`${viewport.name} ${route}: overflow horizontal de ${overflow}px`);
      console.log(`✓ ${viewport.name} ${route}${loginGate ? " (barreira de autenticação)" : " (chunk lazy validado)"}`);
      page.removeListener("request", requestListener);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
