# Smart Pre-Workout Dispenser Platform

Software foundation for a touchscreen pre-workout dispensing machine placed inside gyms —
a customer kiosk, an operator admin dashboard, a REST + WebSocket API, a configurable
ingredient-safety engine, and a hardware abstraction layer that runs on simulated hardware
today and real augers, load cells, and payment terminals later.

> The prototype is fully functional against simulated hardware. Nothing in the UI or the
> business logic talks to a device directly — every hardware call goes through an interface.

---

## Quick start

Requires **Node 20+** and **PostgreSQL 14+**.

```bash
# 1. Install
npm install

# 2. Configure
cp server/.env.example server/.env      # edit DATABASE_URL if needed

# 3. Create the database (skip if it already exists)
createdb preworkout

# 4. Migrate + seed demo data (10 products, 30 days of history)
npm run db:migrate
npm run db:seed

# 5. Run both apps
npm run dev
```

| Surface | URL |
|---|---|
| Customer kiosk | http://localhost:5173 |
| Admin dashboard | http://localhost:5173/admin |
| API | http://localhost:4000/api |

### Demo credentials

Admin access uses a configurable PIN (see [Authentication](#authentication)).

| PIN | User | Role |
|---|---|---|
| `1234` | Sam Rivera | Super Admin |
| `2345` | Alex Chen | Business Admin |
| `3456` | Jordan Blake | Gym Manager |
| `4567` | Riley Novak | Service Technician |

### End-to-end smoke test

With `npm run dev` running in another terminal:

```bash
npm run test:e2e
```

Drives a real browser through the full customer journey, all five simulated hardware
faults, and every admin screen (32 assertions).

---

## What you can do with the prototype

**Customer kiosk**
1. Watch the attract screen cycle through admin-configured promotions.
2. Browse and stack filters (`Stim` + `Moderate Energy` + `No Tingle`).
3. Open a product, tap `[?]` on any major ingredient for a plain-language explanation.
4. Compare two products side by side.
5. Pick 1 or 2 scoops, or mix two products — ingredient totals are computed **server-side**.
6. Watch the safety tracker fill as you add scoops; exceed a limit and the machine explains
   why and offers one-tap fixes ("You could choose 1 scoop instead").
7. Acknowledge warnings, pay (simulated), and watch the dispensing state machine.

**Admin dashboard** — sales/product/interaction analytics with a conversion funnel,
weight-tracked inventory with refill, product/ingredient/warning editors, editable
safety limits, machine health, maintenance tools, fault injection, promotions,
settings, and an audit log.

### Try the safety engine

Add **Static — Sour Gummy** and switch to 2 scoops: 400 mg caffeine against the configured
300 mg cap. The transaction is blocked with an explanation and suggested alternatives.
Change the cap in **Admin → Safety Rules** and the kiosk respects the new value immediately.

### Try a hardware failure

**Admin → Machines → Simulate hardware failure.** Toggle `Dispenser jam`, then run a
purchase on the kiosk: the order fails gracefully, the customer is told they weren't
charged, and the fault lands in the machine error log.

---

## Architecture at a glance

```
web/  React + TypeScript (Vite)          server/  Node + TypeScript (Express)
├── kiosk/   customer touchscreen        ├── routes/     thin HTTP layer
├── admin/   operator dashboard          ├── services/   safety · orders · analytics · quiz
├── design/  tokens + primitives         ├── hardware/   interfaces + simulated adapters
└── api/     typed client                └── prisma/     schema · migrations · seed
                                                    PostgreSQL
```

Five rules the codebase holds to:

1. **Safety math is server-side.** The kiosk renders what `POST /api/kiosk/quote` returns;
   checkout re-runs the identical evaluation, so a tampered client cannot exceed a limit.
2. **Safety values are data, never code.** Limits, combination rules, and warnings are
   database rows editable from the admin UI.
3. **Hardware sits behind interfaces.** `DispenserService`, `ScaleService`,
   `PaymentService`, `InventorySensorService`, `MachineStatusService`.
4. **The schema is multi-machine from day one.** Organization → Gym → Location → Machine → Bin.
5. **Analytics are first-party and anonymous.** An append-only event stream keyed by a
   per-visit UUID; no personally identifiable information is collected.

## Documentation

| Document | Contents |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack rationale, system design, folder layout, roadmap, risks & open decisions |
| [docs/DATABASE.md](docs/DATABASE.md) | Every entity, relationships, and the inventory ledger model |
| [docs/API.md](docs/API.md) | Full kiosk + admin endpoint reference |
| [docs/HARDWARE.md](docs/HARDWARE.md) | The abstraction layer and how to write a real adapter |
| [docs/SAFETY.md](docs/SAFETY.md) | How the limit, combination-rule, and warning engines work |

## Authentication

The prototype authenticates operators with a PIN, exchanged for a bearer token carrying a
role (`SUPER_ADMIN` › `BUSINESS_ADMIN` › `GYM_MANAGER` › `TECHNICIAN`). Routes are gated by
minimum role and every mutation is written to the audit log.

The `User` table already carries `passwordHash` and `mfaSecret` columns, so adding
username/password, MFA, and remote login is a new login route rather than a rewrite. To
change the demo PINs, edit the seed or update `pinHash` (SHA-256 of `pwx-pin:<PIN>`).

> Replace PIN auth before any deployment where the kiosk is physically reachable by the public.

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | API (`:4000`) and web (`:5173`) together |
| `npm run dev:server` / `npm run dev:web` | One at a time |
| `npm run build` | Typecheck the server, build the web bundle |
| `npm run typecheck` | Strict TypeScript across both workspaces |
| `npm run db:migrate` / `npm run db:seed` | Prisma migrate / reseed demo data |
| `npm run test:e2e` | Browser smoke test (needs `npm run dev` running) |

## Not medical advice

Ingredient descriptions are written in plain language for consumer education. They avoid
diagnostic and treatment claims and do not guarantee outcomes. Operators are responsible for
configuring ingredient limits, warnings, and acknowledgement requirements to match their
manufacturer guidance and local regulatory obligations — which is exactly why none of those
values are hard-coded.

All brands and products in the demo data are fictional.
