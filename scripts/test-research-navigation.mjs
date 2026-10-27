import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwind from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const project = process.cwd(),
  output = process.env.RESEARCH_VISUAL_OUTPUT || "/tmp/caronaa-research-visual";
await fs.mkdir(output, { recursive: true });
const fixture = path.join(project, "tests/research-browser/fixtures.ts");
const server = await createServer({
  configFile: false,
  root: path.join(project, "tests/research-browser"),
  cacheDir: path.join(output, "vite-cache"),
  plugins: [react(), tailwind()],
  resolve: {
    alias: [
      { find: "@tanstack/react-start", replacement: fixture },
      { find: "@/integrations/supabase/client", replacement: fixture },
      { find: "@/lib/location.functions", replacement: fixture },
      { find: "@", replacement: path.join(project, "src") },
    ],
  },
  server: { host: "127.0.0.1", port: 5201, strictPort: true, fs: { allow: [project] } },
});
await server.listen();
const executablePath =
  process.env.CHROMIUM_PATH || (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);
let browser;
const results = [];
try {
  browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  for (const width of [375, 768, 1280, 1440]) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      locale: "pt-BR",
      reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const route of ["configuration", "public", "insights"]) {
      await page.goto(`http://127.0.0.1:5201/${route}`);
      await page.waitForSelector("main");
      if (route === "configuration") {
        for (const tab of ["Instituição", "Dias e horários", "Serviço e política"]) {
          await page.getByRole("tab", { name: tab, exact: true }).click();
          assert.equal(
            await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
            false,
            `${width}/${tab} overflow`,
          );
          await page.screenshot({
            path: path.join(output, `${width}-${tab.replaceAll(" ", "-")}.png`),
            fullPage: true,
          });
        }
      }
      if (route === "insights") await page.getByText("60%").waitFor();
      if (route === "public") {
        await page.getByRole("radio", { name: "Sim", exact: true }).click();
        await page.getByRole("button", { name: /Próxima etapa/ }).click();
        await page.getByRole("checkbox", { name: "Seg", exact: true }).check();
        await page.getByLabel("Bairro ou município de origem", { exact: true }).fill("Aldeota");
        await page.getByLabel("Horário de saída", { exact: true }).selectOption("OTHER");
        await page.getByLabel("Horário de saída: outro horário", { exact: true }).fill("08:30");
        await page.getByRole("heading", { name: "Seu trajeto", exact: true }).click();
        await page.screenshot({ path: path.join(output, `${width}-journey.png`), fullPage: true });
        await page.getByRole("checkbox", { name: /Concordo em participar/ }).check();
        await page.getByRole("button", { name: "Enviar respostas", exact: true }).click();
        await page.getByRole("heading", { name: "Resposta registrada!" }).waitFor();
        await page.getByText("Registrar interesse no trajeto (opcional)", { exact: true }).click();
        await page.getByRole("checkbox", { name: /Autorizo registrar meu interesse/ }).check();
        await page
          .getByRole("button", { name: "Quero encontrar uma carona para este trajeto" })
          .click();
        await page.getByText("Interesse registrado", { exact: true }).waitFor();
        assert.equal(
          await page
            .getByRole("button", { name: "Quero disponibilizar lugares neste trajeto" })
            .isEnabled(),
          false,
        );
      }
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
        false,
        `${width}/${route} overflow`,
      );
      await page.screenshot({ path: path.join(output, `${width}-${route}.png`), fullPage: true });
      results.push({ width, route, passed: true });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  // The new academic F01 is tested separately at real compact phone heights.
  for (const { width, height } of [{ width: 375, height: 667 }, { width: 393, height: 852 }]) {
    const page = await browser.newPage({ viewport: { width, height }, locale: "pt-BR", reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("http://127.0.0.1:5201/academic");
    const checkViewport = async label => {
      const dimensions = await page.evaluate(() => ({
        htmlWidth: document.documentElement.scrollWidth,
        bodyHeight: document.body.scrollHeight,
        viewportWidth: innerWidth, viewportHeight: innerHeight,
      }));
      assert.ok(dimensions.htmlWidth <= dimensions.viewportWidth + 1, `${width}x${height}/${label} horizontal overflow`);
      assert.ok(dimensions.bodyHeight <= dimensions.viewportHeight + 1, `${width}x${height}/${label} page scroll`);
      await page.screenshot({ path: path.join(output, `academic-${width}x${height}-${label}.png`) });
    };
    await checkViewport("identity");
    await page.getByPlaceholder("Seu nome completo").fill("Pessoa acadêmica");
    await page.getByRole("button", { name: "Estudante" }).click();
    await page.getByPlaceholder("voce@universidade.br").fill("pessoa@campus.test.br");
    await page.getByRole("button", { name: "Continuar" }).click();
    await checkViewport("role");
    await page.getByRole("button", { name: "Quero pegar e oferecer" }).click();
    await checkViewport("route");
    await page.getByPlaceholder("Bairro ou região de origem").fill("Bairro de teste");
    await page.getByRole("button", { name: "Seg–Sex" }).click();
    await page.getByRole("button", { name: /Manhã.*07:30/ }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await checkViewport("profile");
    await page.getByRole("button", { name: "Carro" }).click();
    await page.getByRole("button", { name: "2" }).click();
    await page.getByRole("button", { name: "Economia no trajeto" }).click();
    await checkViewport("pains");
    await page.getByRole("button", { name: "Ônibus lotados" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await checkViewport("activation");
    assert.deepEqual(errors, [], `Academic express browser errors ${width}x${height}`);
    results.push({ width, height, route: "academic", passed: true });
    await page.close();
  }
  await fs.writeFile(path.join(output, "results.json"), JSON.stringify(results, null, 2));
  console.log(
    `${results.length} viewport/page checks passed, including custom schedules and independent activation. Screenshots: ${output}`,
  );
} finally {
  await browser?.close();
  await server.close();
}
