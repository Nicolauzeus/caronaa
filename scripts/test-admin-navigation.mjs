import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs/promises";
import assert from "node:assert/strict";

// Playwright may be installed outside the project; production dependencies stay unchanged.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const project = process.cwd();
const fixture = path.join(project, "tests/admin-browser/fixtures.ts");
const modules = [
  "@/lib/auth-context",
  "@/integrations/supabase/client",
  "@/lib/admin.functions",
  "@/lib/admin-operations",
  "@/lib/operational-metrics",
  "@/lib/main-funnel-metrics",
  "@/lib/retention-metrics",
  "@/lib/formulario/metrics",
];
const artifacts = process.env.ADMIN_VISUAL_OUTPUT || "/tmp/caronaa-admin-visual";
await fs.mkdir(artifacts, { recursive: true });
const server = await createServer({
  configFile: false,
  cacheDir: path.join(artifacts, "vite-cache"),
  root: path.join(project, "tests/admin-browser"),
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      ...modules.map((find) => ({ find, replacement: fixture })),
      { find: "@", replacement: path.join(project, "src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 5199,
    strictPort: true,
    fs: { allow: [project] },
    proxy: process.env.ADMIN_ASSET_ORIGIN
      ? { "/__l5e": { target: process.env.ADMIN_ASSET_ORIGIN, changeOrigin: true } }
      : undefined,
  },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox"],
});
const results = [];
const departments = [
  "executivo",
  "tecnologia",
  "operacoes",
  "crescimento",
  "inteligencia-pesquisa",
  "parcerias",
  "atendimento",
  "financeiro",
  "compliance",
];
try {
  for (const width of [375, 768, 1280, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const section of ["", ...departments]) {
      await page.goto(`http://127.0.0.1:5199/admin${section ? `/${section}` : ""}`);
      await page.getByRole("heading", { level: 1 }).waitFor();
      if (process.env.ADMIN_ASSET_ORIGIN) {
        await page.waitForFunction(() =>
          Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
        );
      }
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      assert.equal(overflow, false, `${width}: overflow in ${section || "overview"}`);
      const active = page.locator(
        'nav[aria-label="Navegação administrativa"] a[aria-current="page"]',
      );
      assert.equal(await active.count(), 1, `${section}: active department`);
      if (section) {
        const nav = page.locator('nav[aria-label^="Módulos de"]');
        assert.equal(await nav.locator('a[aria-current="page"]').count(), 1);
      }
      await page.screenshot({
        path: path.join(artifacts, `${width}-${section || "overview"}.png`),
        fullPage: true,
      });
      results.push({ width, section: section || "overview", overflow });
    }
    await page.goto("http://127.0.0.1:5199/admin/financeiro#transactions");
    await page.getByRole("heading", { name: "Transações por situação" }).waitFor();
    await page.getByRole("link", { name: "Visão financeira", exact: true }).click();
    await page.goBack();
    await page.getByRole("heading", { name: "Transações por situação" }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: "Transações por situação" }).waitFor();
    if (width < 1024) {
      const opener = page.getByRole("button", { name: "Abrir menu administrativo" });
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "Menu administrativo" });
      await dialog.waitFor();
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });
      await opener.click();
      await dialog.getByRole("link", { name: "Pesquisa", exact: true }).click();
      await dialog.waitFor({ state: "hidden" });
      assert.ok(page.url().includes("inteligencia-pesquisa"));
    } else {
      await page.getByRole("button", { name: "Recolher navegação" }).click();
      assert.equal(await page.locator('nav[aria-label="Navegação administrativa"] a').count(), 10);
      assert.equal(
        await page
          .locator('nav[aria-label="Navegação administrativa"] a[aria-current="page"]')
          .count(),
        1,
      );
      await page.screenshot({
        path: path.join(artifacts, `${width}-collapsed.png`),
        fullPage: true,
      });
      await page.getByRole("button", { name: "Expandir navegação" }).click();
    }
    assert.deepEqual(errors, [], `Browser errors at ${width}`);
    await page.close();
  }
  await fs.writeFile(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2));
  if (process.env.ADMIN_APP_ORIGIN) {
    const visitor = await browser.newPage();
    for (const department of ["", ...departments]) {
      await visitor.goto(
        `${process.env.ADMIN_APP_ORIGIN}/admin${department ? `/${department}` : ""}`,
      );
      await visitor.getByRole("heading", { name: "Acesso restrito", exact: true }).waitFor();
      assert.equal(await visitor.locator('nav[aria-label="Navegação administrativa"]').count(), 0);
    }
    await visitor.screenshot({ path: path.join(artifacts, "actual-app-visitor-denied.png") });
    await visitor.close();
    console.log(
      "10 direct administrative URLs blocked for an unauthenticated browser in the actual local app.",
    );
  }
  console.log(`${results.length} viewport/page checks passed. Screenshots: ${artifacts}`);
} finally {
  await browser.close();
  await server.close();
}
