# Database

PostgreSQL, managed with Prisma. Schema: [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).
Seed: [`server/prisma/seed.ts`](../server/prisma/seed.ts).

```bash
npm run db:migrate      # apply migrations (dev)
npm run db:seed         # reset + reseed demo data
npx prisma studio -w server   # browse the data
```

## Entity map

```
Organization ─┬─ Gym ── Location ── Machine ─┬─ InventoryBin ── InventoryTransaction
              │                              ├─ SaleTransaction ─┬─ TransactionItem
              ├─ Brand ── Product            │                   └─ DispensingEvent
              ├─ Product ─┬─ ProductIngredient ── Ingredient ── IngredientLimit
              │           ├─ ProductWarning ── Warning
              │           └─ ProductTag ── Tag
              └─ User ── AuditLog            ├─ MachineError
                                             ├─ MaintenanceEvent
                                             └─ AnalyticsEvent

Standalone: CombinationRule · SystemSetting · Promotion · EducationTopic
```

## Fleet

| Model | Purpose | Key fields |
|---|---|---|
| `Organization` | Top-level tenant (the operating business) | `name` |
| `Gym` | A customer site | `organizationId` |
| `Location` | Placement within a gym ("Main floor") | `gymId` |
| `Machine` | A physical dispenser | `serial` (unique), `status`, `lastHeartbeatAt`, `lastMaintenanceAt` |

Every sale, error, and analytics event is attributed to a `Machine`, so per-machine,
per-gym, and per-organization reporting are all a `GROUP BY` away.

## Catalog

| Model | Notes |
|---|---|
| `Brand` | Manufacturer |
| `Product` | **One row per brand + name + flavor variant** — see the flavor assumption below |
| `Ingredient` | Central knowledge base powering the kiosk `[?]` tooltips |
| `ProductIngredient` | Join carrying `amountPerScoop` and `major` (highlighted on the detail screen) |
| `Tag` / `ProductTag` | Drives the kiosk filter chips |

`Product` carries the at-a-glance metadata the kiosk renders (`energyRating`, `pumpRating`,
`tingleRating`, `focusRating` on 0–5; `strength`; `isStimulant`), pricing
(`pricePerScoopCents`), physical data (`servingSizeGrams`, `maxScoopsPerServing`), the full
`supplementFacts` JSON panel, and operator-asserted dietary flags gated behind
`dietaryVerified` (the kiosk hides them unless verified).

`caffeineMgPerScoop` is denormalized onto `Product` for fast filtering and sorting. The
source of truth is the `ProductIngredient` row for Caffeine; the admin product endpoint
recomputes the denormalized column whenever ingredients change.

> **Assumption — flavors.** The original spec listed `ProductFlavor` as its own entity. A bin
> physically holds exactly one powder, so a catalog entry maps 1:1 to a bin and a separate
> flavor table would add a join with no behavioral benefit in v1. Adding it later is additive.

## Safety

| Model | Notes |
|---|---|
| `Warning` | `code`, `severity` (`INFO`/`CAUTION`/`IMPORTANT`/`BLOCKING`), `requiresAcknowledgement` |
| `ProductWarning` | Attaches warnings to products; merged and de-duplicated across a mix |
| `IngredientLimit` | `maxPerTransaction` per ingredient — the configurable cap |
| `CombinationRule` | Typed JSON rule configs (`MAX_PRODUCTS_PER_MIX`, `INCOMPATIBLE_TAGS`) |

No safety value is hard-coded anywhere in the application. See [SAFETY.md](./SAFETY.md).

## Inventory — tracked by weight

`InventoryBin` stores `capacityGrams`, `currentGrams`, and `lowThresholdGrams`, plus
`lotNumber`, `expiresAt`, `lastRefillAt`, and a `disabled` flag (used for maintenance or a
product recall). Estimated servings are derived, never stored:

```
estimatedServings = floor(currentGrams / product.servingSizeGrams)
```

`InventoryTransaction` is an append-only ledger (`REFILL` / `DISPENSE` / `ADJUSTMENT` /
`WASTE`) with a signed `deltaGrams`, so stock can always be reconciled against history —
and, once a real load cell is attached, against measured weight.

## Commerce

`SaleTransaction` moves through `PENDING_PAYMENT → DISPENSING → COMPLETED | FAILED`. It
**freezes** `ingredientTotals` (JSON), `totalCaffeineMg`, and `acknowledgedWarningIds` at
purchase time, so a later product edit never rewrites the record of what was actually sold
and what the customer actually agreed to.

`DispensingEvent` is one row per item with its own state machine (`QUEUED → MEASURING →
DISPENSING → READY | FAULTED`) and both `gramsTarget` and `gramsActual` — the pair a real
closed-loop auger + load cell needs for calibration and dispute resolution.

## Operations & engagement

| Model | Notes |
|---|---|
| `MachineError` | `code`, `severity`, `component`, `resolvedAt` |
| `MaintenanceEvent` | Cleaning, refills, calibrations, self-tests |
| `AuditLog` | Every administrative mutation: who, what, when, and a JSON detail blob |
| `SystemSetting` | Key/value JSON (idle timeout, rotation seconds, …) |
| `AnalyticsEvent` | Append-only, indexed on `(type, createdAt)` and `sessionId` |
| `Promotion` | Idle-screen playlist with ordering and scheduling windows |
| `EducationTopic` | Content for the kiosk Learn area |

`AnalyticsEvent.sessionId` is a UUID minted when a customer taps the idle screen and
discarded when the session ends. It groups one visit and is never linked to a person.

## Identity

`User` holds `role` (`SUPER_ADMIN` / `BUSINESS_ADMIN` / `GYM_MANAGER` / `TECHNICIAN`) and
`pinHash` for the prototype, alongside unused `passwordHash` and `mfaSecret` columns so the
authentication upgrade is additive.

## Loyalty (future)

Not implemented in v1. The clean insertion point is a `Customer` table referenced optionally
from `SaleTransaction` — every other table already hangs off the transaction, so points,
order history, and member pricing attach without reshaping the schema. Note that true
*daily* intake limits (as opposed to per-transaction) require this identity layer; see the
open decisions in [ARCHITECTURE.md](./ARCHITECTURE.md#10-architectural-risks--open-product-decisions).

## Demo data

`npm run db:seed` creates 1 organization, 2 gyms, 3 machines, 5 brands, **10 products**,
15 ingredients, 9 warnings, 4 ingredient limits, 2 combination rules, 10 stocked bins,
6 promotions, 5 education topics, 4 users, and ~30 days of seeded-random sales and
interaction history (roughly 460 transactions and 6,000 analytics events) with realistic
morning/evening gym traffic peaks.

The product mix deliberately spans every case the engines need to demonstrate: high-stim,
moderate-stim, beginner, non-stim pump, high-tingle, no-tingle, focus, low-caffeine, an
electrolyte/performance base, and one extreme-stim product that cannot be mixed at all.
