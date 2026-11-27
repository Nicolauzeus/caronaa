import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { publicConnectionDefines } from "../config/public-connection.ts";

assert.equal(process.env.CARONAA_F07_LIVE_SMOKE, "1",
  "Explicit opt-in required: use dedicated offline test accounts only.");
const base = "https://caronaa.com";
const passengerState = process.env.CARONAA_F07_PASSENGER_STORAGE_STATE;
const driverState = process.env.CARONAA_F07_DRIVER_STORAGE_STATE;
assert.ok(passengerState && driverState && passengerState !== driverState,
  "Provide two distinct private Playwright storageState paths.");
const connection = publicConnectionDefines({});
const url = JSON.parse(connection["import.meta.env.VITE_SUPABASE_URL"]);
const key = JSON.parse(connection["import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY"]);
const storageKey = "sb-" + new URL(url).hostname.split(".")[0] + "-auth-token";

function sessionFor(path) {
  const state = JSON.parse(readFileSync(path, "utf8"));
  const item = state.origins?.find(o => o.origin === base)?.localStorage?.find(e => e.name === storageKey);
  assert.ok(item, "Dedicated authenticated storage state for caronaa.com required.");
  const session = JSON.parse(item.value);
  assert.ok(typeof session.access_token === "string" && session.user?.id, "Missing session.");
  assert.ok(session.expires_at * 1000 > Date.now() + 120000, "Refresh the test session before running.");
  return session;
}
const passenger = sessionFor(passengerState), driver = sessionFor(driverState);
assert.notEqual(passenger.user.id, driver.user.id, "Use separate test accounts.");

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || undefined });
const cities = ["Acarape","Aracoiaba","Aratuba","Barreira","Baturité","Capistrano","Fortaleza","Guaiúba","Guaramiranga","Itapiúna","Maracanaú","Mulungu","Ocara","Pacatuba","Pacoti","Palmácia","Redenção"];
const retiredMessage = /\b(?:piloto|homologa[çc][aã]o)\b|janela (?:comercial|de opera[çc][aã]o)|(?:servi[çc]o|opera[çc][aã]o|flash) (?:est[aá] )?expirad[oa]/i;
const farePattern = /R\$\s*[\d.]+,\d{2}/;

async function readApi(context, session, path, body) {
  const response = await context.request.fetch(url + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { apikey: key, Authorization: "Bearer " + session.access_token },
    ...(body === undefined ? {} : { data: body }),
  });
  assert.ok(response.ok(), "Authorized API check failed (HTTP " + response.status() + ").");
  return response.json();
}
async function chooseLocation(page, inputId, query, labelPattern) {
  const input = page.locator("#" + inputId);
  await input.waitFor({ timeout: 30000 });
  await input.fill(query);
  const option = page.getByRole("listbox", { name: "Sugestões de localização" })
    .getByRole("option", { name: labelPattern }).first();
  await option.waitFor({ timeout: 30000 });
  await option.click();
  await page.getByRole("listbox", { name: "Sugestões de localização" }).waitFor({ state: "hidden" });
}
async function noRetiredMessage(page) {
  assert.ok(!(await page.getByText(retiredMessage).filter({ visible: true }).count()),
    "Retired commercial pilot/expiry message is visible.");
}
async function waitEnabled(locator) {
  await locator.waitFor({ timeout: 45000 });
  await locator.click({ trial: true, timeout: 45000 });
  assert.equal(await locator.isEnabled(), true, "Expected an enabled quoted request.");
}
let pc, dc;
try {
  const common = { viewport: { width: 390, height: 844 }, locale: "pt-BR", serviceWorkers: "block" };
  pc = await browser.newContext({ ...common, storageState: passengerState });
  dc = await browser.newContext({ ...common, storageState: driverState });
  // Reject accounts with an ongoing ride or online driver; do not change their state.
  const passengerRides = await readApi(pc, passenger, "/rest/v1/rpc/quick_ride_my_requests", {});
  assert.ok(Array.isArray(passengerRides) && !passengerRides.some(r => ["SEARCHING","ACCEPTED","ARRIVED","IN_PROGRESS"].includes(r.status)),
    "Passenger test account must not have an active request.");
  const access = await readApi(dc, driver, "/rest/v1/rpc/get_my_professional_access", {});
  assert.equal(access?.authorized, true, "Driver test account must be authorized.");
  const presence = await readApi(dc, driver, "/rest/v1/professional_presence?select=is_available&user_id=eq." + encodeURIComponent(driver.user.id));
  assert.ok(Array.isArray(presence) && !presence.some(p => p.is_available), "Driver must be offline.");
  for (const [ctx, session, role] of [[pc,passenger,"passenger"],[dc,driver,"driver"]]) {
    for (const city of cities) for (const vehicle of ["CAR","MOTO"]) {
      const status = await readApi(ctx,session,"/rest/v1/rpc/caronaa_quick_region_status",{p_municipality:city,p_vehicle:vehicle});
      assert.equal(status.status,"ENABLED",role + ": " + city + " / " + vehicle);
      assert.equal(status.dispatch,true,role + ": dispatch " + city + " / " + vehicle);
    }
    console.log("PASS: authenticated coverage 34/34 (" + role + ")");
  }
  // Do not upload precise GPS or allow test clients to activate driver presence.
  await dc.addInitScript(() => {
    for (const k of Object.keys(localStorage)) if (k.startsWith("caronaa:professional-radar-location:")) localStorage.removeItem(k);
  });
  const page = await pc.newPage(), cockpit = await dc.newPage();
  const errors = [];
  for (const p of [page,cockpit]) p.on("pageerror", () => errors.push("uncaught page error"));
  await page.goto(base + "/home", { waitUntil: "domcontentloaded" });
  await page.getByRole("button",{name:"Para onde vamos?",exact:true}).waitFor({ timeout: 45000 });
  assert.equal(new URL(page.url()).pathname,"/home","Passenger route was redirected.");
  // Close only the optional PWA invitation, never bypass auth or consent.
  const dismiss = page.getByRole("button",{name:"Fechar aviso de instalação"});
  const closePwa = async () => { if(await dismiss.isVisible()) await dismiss.click(); };
  await closePwa();
  await page.getByRole("navigation",{name:"Tipo de serviço"}).getByRole("button",{name:"Agora",exact:true}).click();
  await page.getByRole("button",{name:"Ajustar no mapa a origem"}).click();
  await chooseLocation(page,"passenger-pickup","Praça do Ferreira Fortaleza",/Praça do Ferreira/i);
  await closePwa();
  if (await page.getByRole("button",{name:"Para onde vamos?",exact:true}).isVisible())
    await page.getByRole("button",{name:"Para onde vamos?",exact:true}).click();
  await chooseLocation(page,"shell-destination","Mercado Central Fortaleza",/Mercado Central/i);
  await closePwa();
  for (const mode of ["Carro","Moto"]) {
    const option = page.getByRole("radio",{name:new RegExp("Flash " + mode)});
    await waitEnabled(option);
    const quotedPrice = (await option.innerText()).match(farePattern)?.[0];
    assert.ok(quotedPrice,"Missing quoted price for " + mode);
    await closePwa();
    await option.click();
    const request = page.getByRole("button",{name:/^(Solicitar e aguardar motorista|Confirmar Flash (Carro|Moto)|Confirmar corrida por).*R\$/});
    await waitEnabled(request);
    assert.ok((await request.innerText()).replace(/\s/g,"").includes(quotedPrice.replace(/\s/g,"")),
      "Displayed request price differs from quote.");
    await noRetiredMessage(page);
    console.log("PASS: " + mode + " quoted request enabled; NOT submitted.");
    if (mode === "Carro") await page.getByRole("button",{name:"Voltar às opções"}).click();
  }
  await cockpit.goto(base + "/disponibilidade-profissional",{waitUntil:"domcontentloaded"});
  await cockpit.getByRole("heading",{name:"Cockpit Operacional"}).waitFor({timeout:45000});
  assert.equal(new URL(cockpit.url()).pathname,"/disponibilidade-profissional");
  const online = cockpit.getByRole("button",{name:"FICAR ONLINE AGORA"});
  await waitEnabled(online);
  await noRetiredMessage(cockpit);
  assert.deepEqual(errors,[],"Uncaught browser errors.");
  console.log("PASS: driver cockpit offline and available for explicit activation; no activation performed.");
} finally {
  await pc?.close(); await dc?.close(); await browser.close();
}
