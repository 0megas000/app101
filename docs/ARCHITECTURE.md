# Architecture — Smart Pre-Workout Dispenser Platform

Phase 1 deliverable. This document records the technology choices, system design,
and the assumptions made where the specification left room for judgement.

---

## 1. Technology stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React 18 + TypeScript + Vite | Fast dev loop, strict typing, no SSR needed for a kiosk (the kiosk is a long-lived local fullscreen app, not a crawlable website — Next.js adds cost without benefit here) |
| Routing | React Router | Kiosk (`/`) and Admin (`/admin`) live in one build but are fully isolated route trees |
| Styling | Hand-rolled design-token CSS (dark-first) | A kiosk needs a small, deliberate design system with huge touch targets — a token sheet + ~10 primitives beats a utility framework for this surface |
| Backend | Node 22 + TypeScript + Express | Boring, production-proven, easy to embed on kiosk hardware (a small industrial PC) |
| Validation | Zod | Every mutating endpoint validates its body server-side |
| Database | PostgreSQL 16 | Spec requirement; correct choice for the multi-machine backend |
| ORM | Prisma | Migrations, type-safe client, readable schema |
| Real-time | `ws` (WebSocket) on the same HTTP server | Inventory/machine-status/order push to admin dashboards |
| Analytics | First-party `AnalyticsEvent` table | No third-party dependency; aggregation done server-side |
| Auth (prototype) | Configurable admin PIN → server-issued bearer token, role attached | Architected as `User` + `Role` in the schema so username/password, MFA and remote login slot in later |

## 2. System architecture

```
┌────────────────────────────── Kiosk device ──────────────────────────────┐
│  ┌─────────────┐   REST /api/kiosk    ┌──────────────────────────────┐   │
│  │  Kiosk UI   │ ───────────────────▶ │        API server            │   │
│  │ (React SPA) │ ◀─── WS /ws ──────── │  Express + Zod               │   │
│  └─────────────┘                      │  ┌────────────────────────┐  │   │
│  ┌─────────────┐   REST /api/admin    │  │ Domain services        │  │   │
│  │  Admin UI   │ ───────────────────▶ │  │ safety / orders /      │  │   │
│  │ (React SPA) │                      │  │ analytics / quiz       │  │   │
│  └─────────────┘                      │  ├────────────────────────┤  │   │
│                                       │  │ Hardware Abstraction   │  │   │
│                                       │  │ Layer (interfaces)     │  │   │
│                                       │  ├───────────┬────────────┤  │   │
│                                       │  │ Simulated │ Real       │  │   │
│                                       │  │ adapters  │ adapters   │  │   │
│                                       │  │ (now)     │ (later)    │  │   │
│                                       │  └───────────┴────────────┘  │   │
│                                       │            Prisma            │   │
│                                       └──────────────┬───────────────┘   │
│                                                PostgreSQL                │
└──────────────────────────────────────────────────────────────────────────┘
```

Key separations (spec §32):

- **UI** never computes safety-relevant numbers. It renders what the server's
  quote endpoint returns. Client-side totals are display hints only.
- **Business logic** lives in `server/src/services/*` — routes are thin.
- **Safety logic** is one module (`services/safety`) driven entirely by
  database rows (`IngredientLimit`, `CombinationRule`), never hard-coded values.
- **Hardware** is only reachable through interfaces in `server/src/hardware`.
- **Analytics** is an append-only event stream, aggregated on read.

Deployment model: in production each machine runs the API server locally
(hardware access must survive network loss) and syncs to a central backend.
For the prototype a single server plays both roles; the schema is already
multi-tenant (Organization → Gym → Location → Machine → Bin) so promotion to a
central fleet backend is a deployment change, not a rewrite.

## 3. Folder structure

```
app101/
├── package.json               # npm workspaces root (server, web)
├── docs/                      # architecture, database, API, hardware, safety
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts            # demo org/gym/machine, 10 products, history
│   └── src/
│       ├── index.ts           # bootstrap: express + ws + hardware manager
│       ├── config.ts          # env-driven config
│       ├── lib/               # prisma client, token store, ws hub
│       ├── middleware/        # requireAdmin(role), audit helper
│       ├── hardware/
│       │   ├── types.ts       # DispenserService, ScaleService, PaymentService,
│       │   │                  # InventorySensorService, MachineStatusService
│       │   ├── simulated/     # Simulated* implementations + fault injection
│       │   └── manager.ts     # per-machine adapter registry
│       ├── services/
│       │   ├── safety/        # ingredient limit + combination-rule engine
│       │   ├── orders/        # quote, checkout, dispense orchestration
│       │   ├── analytics/     # event ingest + aggregations (sales, funnel)
│       │   └── quiz/          # rule-based "Find My Pre" scoring
│       └── routes/            # kiosk.ts, admin.ts (thin HTTP layer)
└── web/
    └── src/
        ├── api/               # typed fetch client
        ├── design/            # tokens.css + primitive components
        ├── kiosk/             # screens + KioskContext (session, cart, timeout)
        └── admin/             # screens + AdminContext (auth token)
```

## 4. Database schema (core entities)

Full column detail in [DATABASE.md](./DATABASE.md). Entities:

- **Fleet**: `Organization → Gym → Location → Machine → InventoryBin`
- **Catalog**: `Brand`, `Product` (one row per brand+name+flavor variant),
  `Ingredient`, `ProductIngredient` (amount + unit per scoop), `Tag`/`ProductTag`
- **Safety**: `Warning` (severity INFO/CAUTION/IMPORTANT/BLOCKING),
  `ProductWarning`, `IngredientLimit` (max per transaction, configurable),
  `CombinationRule` (JSON-configured, e.g. max products per mix)
- **Commerce**: `SaleTransaction`, `TransactionItem`, `DispensingEvent`,
  `InventoryTransaction` (weight-based ledger: refill / dispense / adjust / waste)
- **Operations**: `MachineError`, `MaintenanceEvent`, `AuditLog`, `SystemSetting`
- **Engagement**: `AnalyticsEvent`, `Promotion` (idle-screen playlist),
  `EducationTopic`
- **Identity**: `User` (role enum SUPER_ADMIN / BUSINESS_ADMIN / GYM_MANAGER /
  TECHNICIAN; PIN hash now, password/MFA columns later)

**Assumption — flavors:** the spec lists `ProductFlavor` as an entity, but a
bin physically holds exactly one powder. Each catalog entry is therefore a
*product variant* (brand + name + flavor) mapped 1:1 to bins. A separate
flavor table would add a join with no v1 behavior. Documented trade-off;
adding the table later is additive.

**Inventory is tracked in grams** (`capacityGrams`, `currentGrams`,
`servingSizeGrams`), so estimated servings are derived — ready for a real
load-cell adapter to write measured weights.

## 5. API design

REST, JSON, two namespaces (full reference in [API.md](./API.md)):

- `/api/kiosk/*` — unauthenticated (physical access = authorization), scoped
  to the machine identity the server is configured with. Products, ingredients,
  education, promotions, quiz, **quote**, orders, analytics ingest.
- `/api/admin/*` — bearer token from PIN login; role-gated; mutations audited.

The critical safety endpoint:

```
POST /api/kiosk/quote   { items: [{ productId, scoops }] }
→ 200 {
    items, pricing { total },
    totals: [{ ingredientId, name, amount, unit }],
    limits: [{ ingredient, amount, max, remaining, exceeded }],
    warnings: [{ severity, title, body, requiresAcknowledgement }],
    allowed: boolean,
    violations: [{ message, suggestions: ["Choose 1 scoop instead", ...] }]
  }
```

`POST /api/kiosk/orders` re-runs the same evaluation server-side and rejects
any cart the quote would reject — the client can never bypass a limit.

## 6. Hardware abstraction strategy

All hardware sits behind TypeScript interfaces (`server/src/hardware/types.ts`):
`DispenserService`, `InventorySensorService`, `ScaleService`, `PaymentService`,
`MachineStatusService`. A `HardwareManager` composes one adapter set per
machine. The prototype registers `Simulated*` implementations that model
delays, jams, sensor faults, and low/empty bins; faults are injectable from the
admin Maintenance screen. Real adapters (serial/GPIO/payment-terminal SDKs)
implement the same interfaces — no UI or business-logic changes required.
Dispensing is orchestrated as a server-side state machine
(`MEASURING → DISPENSING → READY | FAULTED`) persisted as `DispensingEvent`s,
so a power loss mid-dispense is recoverable and auditable.

## 7. Safety rules architecture

- `IngredientLimit` rows define per-transaction maxima (caffeine 300 mg,
  beta-alanine, yohimbine… all editable in admin). Nothing is hard-coded.
- `CombinationRule` rows are typed JSON configs (v1 ships `MAX_PRODUCTS_PER_MIX`
  and `INCOMPATIBLE_TAGS`); the evaluator is a registry so new rule types are
  plug-ins.
- The engine returns *explanations and suggestions*, not just booleans, so the
  kiosk can say "You could choose 1 scoop instead."
- Warnings merge and de-duplicate across mixed products; any warning flagged
  `requiresAcknowledgement` (and every BLOCKING/IMPORTANT one) must be
  acknowledged before payment; acknowledgements are stored on the transaction.
- All evaluation is server-side; the same module is the single source of truth
  for quote and checkout.

## 8. Analytics event model

Append-only `AnalyticsEvent { machineId, sessionId, type, payload, createdAt }`.
An anonymous `sessionId` (UUID, minted at idle-screen tap, never linked to a
person) groups a kiosk visit. Event types:

`session_start`, `tap`, `filter_applied`, `product_viewed`,
`ingredient_info_opened`, `products_compared`, `added_to_mix`, `quiz_started`,
`quiz_completed`, `limit_blocked`, `checkout_started`,
`warnings_acknowledged`, `payment_completed`, `payment_failed`,
`session_timeout`.

The funnel (visits → product view → selection → checkout → paid) and all
sales/interaction reports are computed from this stream plus the transaction
tables. No PII is collected.

## 9. Development roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | This document | ✅ |
| 2 | Workspaces, Prisma schema + migration, seed (10 products), auth, API foundation, design tokens | ✅ |
| 3 | Full customer kiosk journey (idle → browse/filter → detail/education → compare → mix/servings with live limit meter → warnings → checkout → dispense → idle) + quiz | ✅ |
| 4 | Admin: overview, sales & interaction analytics, inventory, product/ingredient/warning/limit management, machine status, maintenance, promotions, settings, audit log | ✅ |
| 5 | Simulated hardware fault injection wired to maintenance screen and kiosk error handling | ✅ |
| 6+ | Real hardware adapters, central fleet backend, loyalty/QR profiles, payments integration | future |

## 10. Architectural risks & open product decisions

1. **Regulatory variance** — ingredient limits and required acknowledgements
   differ by jurisdiction. Mitigated: everything is data, nothing is code; but
   *someone must own the numbers* (flagged as an operational requirement).
2. **Daily-intake limits across transactions** — without identity, the machine
   can only limit *per transaction*. A user can buy twice. True daily caps
   need the future QR/loyalty identity layer. Documented, not solved, in v1.
3. **Offline operation** — production machines must dispense while the WAN is
   down. The local-server-per-machine deployment covers this; the sync
   protocol (machine → central) is future work and the main distributed-systems
   risk.
4. **Payment certification** — real card present payments (EMV) will be a
   terminal SDK integration; `PaymentService` isolates it, but PCI scope needs
   a product decision (semi-integrated terminal recommended, keeps the kiosk
   out of PCI scope).
5. **Powder dispensing accuracy** — closed-loop dispensing (auger + load cell)
   is assumed; the `DispensingEvent` model stores target vs. actual grams to
   support calibration from day one.
6. **Allergen data integrity** — allergen/dietary filters are only shown when
   product metadata is verified; the schema has the fields, and the admin UI
   marks them as operator-asserted.
