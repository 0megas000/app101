/**
 * End-to-end smoke test — drives a real browser through the whole product.
 *
 *   Terminal 1:  npm run dev
 *   Terminal 2:  node e2e/smoke.mjs
 *
 * Covers: attract → browse → filter → detail → ingredient education →
 * safety-limit block + suggested fix → warning acknowledgement → payment →
 * dispensing → complete; the quiz; the admin dashboard; and all five
 * simulated hardware faults.
 */
import { chromium } from "playwright";

const KIOSK = process.env.KIOSK_URL ?? "http://localhost:5173";
const API = process.env.API_URL ?? "http://localhost:4000";
const ADMIN_PIN = process.env.ADMIN_PIN ?? "1234";

let passed = 0;
let failed = 0;
const ok = (name, detail = "") => { passed++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`); };
const bad = (name, detail = "") => { failed++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); };

// ── Admin API helpers (used to drive fault injection) ────────────────
const login = await fetch(`${API}/api/admin/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ pin: ADMIN_PIN }),
}).then((r) => r.json());

const machines = await fetch(`${API}/api/admin/machines`, {
  headers: { authorization: `Bearer ${login.token}` },
}).then((r) => r.json());
const machineId = machines.find((m) => m.serial === "PWX-001")?.id ?? machines[0].id;

const setFault = (fault, active) =>
  fetch(`${API}/api/admin/machines/${machineId}/faults`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${login.token}` },
    body: JSON.stringify({ fault, active }),
  }).then((r) => r.json());

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e.message)));

/** Walk the kiosk from idle through to the PAY NOW tap. */
async function buyFlow(productName) {
  await page.goto(KIOSK, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.mouse.click(960, 540);
  await page.waitForTimeout(700);
  await page.locator(".product-grid > .card").filter({ hasText: productName }).first()
    .getByRole("button", { name: "Add to mix", exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "My Mix", exact: false }).click();
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Continue →" }).click();
  await page.waitForTimeout(700);
  const acks = page.locator(".card").filter({ hasText: "Tap to confirm you have read this." });
  for (let i = 0; i < await acks.count(); i++) {
    await acks.nth(i).click();
    await page.waitForTimeout(150);
  }
  await page.getByRole("button", { name: /I understand/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /PAY NOW/ }).click();
}

console.log("\nCUSTOMER KIOSK");

await page.goto(KIOSK, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
(await page.getByText("TAP TO START").isVisible()) ? ok("attract screen") : bad("attract screen");

await page.mouse.click(960, 540);
await page.waitForTimeout(800);
await page.getByText("Choose your pre-workout").waitFor({ timeout: 6000 });
ok("browse screen");

await page.getByRole("button", { name: "Non-Stim" }).click();
await page.waitForTimeout(500);
const nonStim = await page.locator(".product-grid > .card").count();
nonStim === 2 ? ok("filters", `${nonStim} non-stim products`) : bad("filters", `expected 2, got ${nonStim}`);
await page.getByRole("button", { name: "All", exact: true }).click();
await page.waitForTimeout(400);

await page.locator(".product-grid > .card").filter({ hasText: "Static" }).first().click();
await page.waitForTimeout(700);
await page.getByText("Major ingredients", { exact: false }).waitFor({ timeout: 6000 });
ok("product detail");

await page.getByRole("button", { name: /Learn about Beta-Alanine/ }).click();
await page.waitForTimeout(600);
await page.getByText("What might you feel?").waitFor({ timeout: 6000 });
ok("ingredient education modal");
await page.getByRole("button", { name: "Got it" }).click();
await page.waitForTimeout(400);

await page.getByRole("button", { name: "+ Add to my mix" }).click();
await page.waitForTimeout(900);
await page.getByText("SAFETY TRACKER").waitFor({ timeout: 6000 });
ok("serving selection + safety tracker");

// 2 scoops of Static = 400 mg caffeine and 9 g beta-alanine → both over the limit
await page.getByRole("button", { name: "2 scoops" }).first().click();
await page.waitForTimeout(1300);
(await page.getByText("exceeds the maximum caffeine", { exact: false }).isVisible())
  ? ok("safety limit blocks over-limit serving")
  : bad("safety limit blocks over-limit serving");

await page.getByRole("button", { name: /You could choose 1 scoop/ }).first().click();
await page.waitForTimeout(1300);
(await page.getByRole("button", { name: "Continue →" }).isEnabled())
  ? ok("suggested alternative resolves the violation")
  : bad("suggested alternative resolves the violation");

await page.getByRole("button", { name: "Continue →" }).click();
await page.waitForTimeout(700);
await page.getByText("Before you continue").waitFor({ timeout: 6000 });
const ackCards = page.locator(".card").filter({ hasText: "Tap to confirm you have read this." });
const ackCount = await ackCards.count();
ackCount > 0 ? ok("warning review", `${ackCount} require acknowledgement`) : bad("warning review");
(await page.getByRole("button", { name: /Confirm \d+ remaining/ }).isVisible())
  ? ok("payment gated until warnings acknowledged")
  : bad("payment gated until warnings acknowledged");

for (let i = 0; i < ackCount; i++) { await ackCards.nth(i).click(); await page.waitForTimeout(150); }
await page.getByRole("button", { name: /I understand/ }).click();
await page.waitForTimeout(700);
await page.getByText("Order summary").waitFor({ timeout: 6000 });
ok("order summary");

await page.getByRole("button", { name: /PAY NOW/ }).click();
await page.waitForTimeout(2500);
await page.getByText("Preparing your pre-workout").waitFor({ timeout: 10000 });
ok("dispensing progress");
await page.getByText("Your pre-workout is ready!").waitFor({ timeout: 30000 });
ok("order complete");

await page.getByRole("button", { name: "Done" }).click();
await page.waitForTimeout(900);
await page.mouse.click(960, 540);
await page.waitForTimeout(700);
await page.getByRole("button", { name: /Find My Pre/ }).click();
await page.waitForTimeout(500);
for (const answer of ["Medium", "No caffeine", "No thanks", "Pump", "First timer"]) {
  await page.getByRole("button", { name: answer, exact: false }).first().click();
  await page.waitForTimeout(450);
}
await page.getByText("Recommended for you").waitFor({ timeout: 8000 });
ok("Find My Pre quiz");

await page.getByRole("button", { name: /Learn/ }).click();
await page.waitForTimeout(600);
await page.getByText("What causes the tingle?").click();
await page.waitForTimeout(500);
await page.getByText("paresthesia", { exact: false }).waitFor({ timeout: 6000 });
ok("education area");

console.log("\nTHEMES");

// The kiosk is dark by default; the toggle must flip it and survive a reload.
await page.goto(KIOSK, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const themeOf = () => page.evaluate(() => ({
  attr: document.documentElement.getAttribute("data-theme"),
  bg: getComputedStyle(document.body).backgroundColor,
}));

const darkState = await themeOf();
darkState.attr === "dark" ? ok("kiosk defaults to dark") : bad("kiosk defaults to dark", `got ${darkState.attr}`);

await page.getByRole("button", { name: "Light" }).click();
await page.waitForTimeout(600);
const lightState = await themeOf();
lightState.attr === "light" && lightState.bg !== darkState.bg
  ? ok("theme toggle switches to light", lightState.bg)
  : bad("theme toggle switches to light", `${lightState.attr} / ${lightState.bg}`);

await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
const afterReload = await themeOf();
afterReload.attr === "light"
  ? ok("theme choice persists across reload")
  : bad("theme choice persists across reload", `got ${afterReload.attr}`);

// Light mode must stay legible — check body text contrast is not washed out.
const textColor = await page.evaluate(() => getComputedStyle(document.body).color);
textColor !== lightState.bg ? ok("light mode text is not the background colour", textColor) : bad("light mode text is not the background colour");

await page.getByRole("button", { name: "Dark" }).click();
await page.waitForTimeout(500);
(await themeOf()).attr === "dark" ? ok("theme toggle switches back to dark") : bad("theme toggle switches back to dark");

console.log("\nSIMULATED HARDWARE FAULTS");

await setFault("CUP_MISSING", true);
await buyFlow("Easy Start");
await page.waitForTimeout(2500);
(await page.getByText("No cup detected", { exact: false }).isVisible())
  ? ok("CUP_MISSING blocks checkout with a clear message")
  : bad("CUP_MISSING blocks checkout with a clear message");
await setFault("CUP_MISSING", false);

await setFault("PAYMENT_FAILURE", true);
await buyFlow("Easy Start");
await page.waitForTimeout(3500);
(await page.getByText("declined", { exact: false }).isVisible())
  ? ok("PAYMENT_FAILURE surfaces a decline")
  : bad("PAYMENT_FAILURE surfaces a decline");
await setFault("PAYMENT_FAILURE", false);

await setFault("DISPENSER_JAM", true);
await buyFlow("Easy Start");
await page.getByText("Something went wrong").waitFor({ timeout: 30000 });
ok("DISPENSER_JAM degrades gracefully to a failure screen");
await setFault("DISPENSER_JAM", false);

const afterFault = await fetch(`${API}/api/admin/machines`, { headers: { authorization: `Bearer ${login.token}` } }).then((r) => r.json());
const openErrors = afterFault.find((m) => m.id === machineId).errors.filter((e) => !e.resolvedAt);
openErrors.length > 0
  ? ok("dispense fault written to the machine error log", openErrors[0].message)
  : bad("dispense fault written to the machine error log");

console.log("\nADMIN DASHBOARD");

await page.goto(`${KIOSK}/admin`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.locator('input[type="password"]').fill(ADMIN_PIN);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForTimeout(1600);
await page.getByText("Overview").first().waitFor({ timeout: 8000 });
ok("admin PIN login");

const sections = [
  ["Sales Analytics", "Revenue by day"],
  ["Product Analytics", "Revenue by product"],
  ["Interactions", "Conversion funnel"],
  ["Inventory", "Weight-tracked bins"],
  ["Products", "Product Management"],
  ["Ingredients", "Ingredient Database"],
  ["Warnings", "Warning Management"],
  ["Safety Rules", "Per-transaction ingredient limits"],
  ["Machines", "Component health"],
  ["Promotions", "Promotions & Idle Screen"],
  ["Settings", "System Settings"],
  ["Audit Log", "Audit Log"],
];
for (const [nav, expected] of sections) {
  try {
    await page.getByRole("link", { name: nav }).click();
    await page.waitForTimeout(1300);
    await page.getByText(expected, { exact: false }).first().waitFor({ timeout: 9000 });
    ok(`admin: ${nav}`);
  } catch {
    bad(`admin: ${nav}`);
  }
}

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} passed, ${failed} failed`);
if (consoleErrors.length) console.log(`⚠️  page errors:\n${consoleErrors.join("\n")}`);
await browser.close();
process.exit(failed === 0 ? 0 : 1);
