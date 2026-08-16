/**
 * One-command setup — `npm run setup`.
 *
 * Written for someone who has never used a terminal: it checks each
 * prerequisite, explains any problem in plain language, and does the rest
 * (create the database, write server/.env, create tables, load demo data).
 *
 * Cross-platform by design — the real machines will run Linux, but testing
 * commonly happens on Windows or macOS. It talks to PostgreSQL over the
 * network rather than shelling out to `psql`, which is frequently missing
 * from PATH on Windows.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = join(ROOT, "server", ".env");

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const say = (msg = "") => console.log(msg);
const step = (n, total, msg) => say(`\n${BOLD}[${n}/${total}] ${msg}${RESET}`);
const good = (msg) => say(`  ${GREEN}✓${RESET} ${msg}`);
const warn = (msg) => say(`  ${YELLOW}!${RESET} ${msg}`);
const info = (msg) => say(`  ${DIM}${msg}${RESET}`);

function fail(title, lines) {
  say(`\n${RED}${BOLD}✗ ${title}${RESET}\n`);
  for (const line of lines) say(`  ${line}`);
  say("");
  process.exit(1);
}

/**
 * Interactive when a human is present, environment-driven when not — so the
 * same script serves a first-time tester and an unattended machine install:
 *
 *   PGHOST=… PGPORT=… PGUSER=… PGPASSWORD=… npm run setup
 */
const INTERACTIVE = Boolean(process.stdin.isTTY);
const rl = INTERACTIVE ? createInterface({ input: process.stdin, output: process.stdout }) : null;

const ask = async (question, fallback, envVar) => {
  const fromEnv = envVar ? process.env[envVar] : undefined;
  if (fromEnv !== undefined) return fromEnv;
  if (!rl) return fallback ?? "";
  const answer = (await rl.question(`  ${question}${fallback ? ` ${DIM}[${fallback}]${RESET}` : ""}: `)).trim();
  return answer || fallback || "";
};

/** Run a command, streaming its output. Resolves false on a non-zero exit. */
function run(command, args, label) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32", // npm is npm.cmd on Windows
    });
    let output = "";
    child.stdout.on("data", (d) => { output += d; });
    child.stderr.on("data", (d) => { output += d; });
    child.on("close", (code) => {
      if (code !== 0) {
        say(`\n${RED}  ${label} failed:${RESET}`);
        say(output.split("\n").map((l) => `    ${l}`).join("\n"));
      }
      resolve(code === 0);
    });
  });
}

const TOTAL = 6;

say(`\n${BOLD}Pre-Workout Dispenser — setup${RESET}`);
say(`${DIM}This will get the app running on your computer. It is safe to run again.${RESET}`);

// ── 1. Node version ──────────────────────────────────────────────────
step(1, TOTAL, "Checking Node.js");
const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  fail(`Node.js ${process.versions.node} is too old`, [
    "This project needs Node.js 20 or newer.",
    "Download the LTS version from https://nodejs.org and run this again.",
  ]);
}
good(`Node.js ${process.versions.node}`);

// ── 2. Dependencies installed ────────────────────────────────────────
step(2, TOTAL, "Checking project dependencies");
if (!existsSync(join(ROOT, "node_modules", "@prisma", "client"))) {
  fail("Dependencies are not installed", [
    "Run this first, then try again:",
    "",
    `    ${BOLD}npm install${RESET}`,
  ]);
}
good("Dependencies are installed");

// ── 3. PostgreSQL connection ─────────────────────────────────────────
step(3, TOTAL, "Connecting to PostgreSQL");
if (INTERACTIVE) {
  say(`  ${DIM}PostgreSQL must already be installed and running. During installation you${RESET}`);
  say(`  ${DIM}chose a password for the "postgres" user — that is what it wants below.${RESET}\n`);
} else {
  info("Non-interactive — reading PGHOST / PGPORT / PGUSER / PGPASSWORD.");
}

const host = await ask("Host", "localhost", "PGHOST");
const port = await ask("Port", "5432", "PGPORT");
const superUser = await ask("Admin username", "postgres", "PGUSER");
const superPass = await ask("Admin password", "", "PGPASSWORD");

const adminConfig = { host, port: Number(port), user: superUser, password: superPass, database: "postgres" };

async function connectAdmin() {
  const client = new pg.Client(adminConfig);
  await client.connect();
  return client;
}

let admin;
try {
  admin = await connectAdmin();
  good(`Connected to PostgreSQL at ${host}:${port}`);
} catch (err) {
  const message = String(err.message ?? err);
  if (message.includes("ECONNREFUSED")) {
    fail("PostgreSQL is not running", [
      `Nothing answered at ${host}:${port}.`,
      "",
      "  Windows: open 'Services', find 'postgresql-x64-…', and click Start.",
      "  macOS:   brew services start postgresql@16",
      "  Linux:   sudo service postgresql start",
      "",
      "Then run this again.",
    ]);
  }
  if (message.includes("password") || message.includes("authentication")) {
    fail("That username or password was not accepted", [
      "Use the password you set when installing PostgreSQL.",
      "If you have forgotten it, the simplest fix is to reinstall PostgreSQL",
      "and write the new password down.",
      "",
      `PostgreSQL said: ${message}`,
    ]);
  }
  fail("Could not connect to PostgreSQL", [message, "", "Then run this again."]);
}

// ── 4. Create the database ───────────────────────────────────────────
step(4, TOTAL, "Setting up the database");
const DB_NAME = "preworkout";
const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
if (exists.rowCount > 0) {
  good(`Database "${DB_NAME}" already exists — reusing it`);
} else {
  await admin.query(`CREATE DATABASE ${DB_NAME}`);
  good(`Created database "${DB_NAME}"`);
}
await admin.end();

// Verify we can actually reach the new database before writing config for it.
try {
  const check = new pg.Client({ ...adminConfig, database: DB_NAME });
  await check.connect();
  await check.end();
  good(`Verified access to "${DB_NAME}"`);
} catch (err) {
  fail(`Created the database but could not connect to it`, [String(err.message ?? err)]);
}

// ── 5. Write server/.env ─────────────────────────────────────────────
step(5, TOTAL, "Writing configuration");
const encodedPass = encodeURIComponent(superPass);
const databaseUrl = `postgresql://${encodeURIComponent(superUser)}:${encodedPass}@${host}:${port}/${DB_NAME}`;

if (existsSync(ENV_PATH)) {
  const current = readFileSync(ENV_PATH, "utf8");
  const updated = current.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${databaseUrl}"`);
  writeFileSync(ENV_PATH, updated.includes("DATABASE_URL") ? updated : `${current}\nDATABASE_URL="${databaseUrl}"\n`);
  good("Updated server/.env with your database details");
} else {
  const example = readFileSync(join(ROOT, "server", ".env.example"), "utf8");
  writeFileSync(ENV_PATH, example.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${databaseUrl}"`));
  good("Created server/.env");
}
info("This file holds your database password and is never committed to git.");

// ── 6. Tables + demo data ────────────────────────────────────────────
step(6, TOTAL, "Creating tables and loading demo data");
info("This takes about a minute the first time…");

if (!await run("npm", ["run", "db:migrate"], "Creating tables")) {
  fail("Could not create the database tables", ["The error above has the details."]);
}
good("Tables created");

if (!await run("npm", ["run", "db:seed"], "Loading demo data")) {
  fail("Could not load the demo data", ["The error above has the details."]);
}
good("Demo data loaded — 10 products and 30 days of sales history");

// ── Done ─────────────────────────────────────────────────────────────
say(`\n${GREEN}${BOLD}Setup complete.${RESET}\n`);
say(`  Start the app with:   ${BOLD}npm start${RESET}`);
say("");
say(`  Then open your web browser to:`);
say(`    Kiosk (customer screen)   ${BOLD}http://localhost:5173${RESET}`);
say(`    Admin dashboard           ${BOLD}http://localhost:5173/admin${RESET}   ${DIM}PIN 1234${RESET}`);
say("");

const startNow = INTERACTIVE ? (await ask("Start the app now? (y/n)", "y")).toLowerCase() : "n";
rl?.close();

if (startNow.startsWith("y")) {
  say(`\n${BOLD}Starting…${RESET} ${DIM}(press Ctrl+C to stop)${RESET}\n`);
  spawn("npm", ["start"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
} else {
  say(`\nRun ${BOLD}npm start${RESET} whenever you are ready.\n`);
}
