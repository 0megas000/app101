# Safety Rules

All safety logic lives in one module —
[`server/src/services/safety.ts`](../server/src/services/safety.ts) — and is driven entirely
by database rows. There are no hard-coded ingredient limits anywhere in the codebase.

## Two rules that hold everywhere

**1. The client is never trusted.** `POST /api/kiosk/quote` and `POST /api/kiosk/orders`
call the same `evaluateCart` function. The kiosk renders what the quote returns; checkout
re-evaluates from scratch and refuses anything the quote would refuse. Calling the order
endpoint directly with a hand-crafted payload gets the same `422`.

**2. Safety values are data, not code.** Limits, combination rules, and warnings are rows
editable from the admin UI. Changes apply on the next quote — no restart, no deploy. This is
deliberate: actual legal, regulatory, and manufacturer requirements vary by jurisdiction and
change over time, so the correct values must be an operator decision rather than a commit.

## What `evaluateCart` does

Given `[{ productId, scoops }]` it returns a single evaluation covering pricing, ingredient
totals, limit status, merged warnings, and violations with suggested fixes:

1. **Resolve products.** A missing or deactivated product is a violation, not a crash.
2. **Enforce per-product scoop caps** (`Product.maxScoopsPerServing` — `Overdrive` and
   `Redline X` are 1-scoop-only).
3. **Sum every ingredient** across all products and scoops, server-side.
4. **Check each active `IngredientLimit`** against the totals.
5. **Evaluate each active `CombinationRule`.**
6. **Merge and de-duplicate warnings** across all products, sorted by severity.
7. **Return `allowed`** — true only when there are zero violations and at least one item.

## Ingredient limits

Each `IngredientLimit` row sets `maxPerTransaction` for one ingredient. Seeded defaults:

| Ingredient | Cap | Rationale (editable) |
|---|---|---|
| Caffeine | 300 mg | Aligned with common single-dose guidance |
| Beta-Alanine | 6.4 g | Upper end of studied single-day dosing |
| Yohimbine | 2.5 mg | Conservative; strong stimulant |
| Huperzine A | 0.2 mg | Long half-life |

Any ingredient present in the cart with a configured limit appears in the `limits` array,
which the kiosk renders as a live progress meter (green → amber above 80% → red when
exceeded). Adding a new limited ingredient is an admin action, not a code change.

### Suggestions, not just refusals

A blocked cart returns concrete, actionable alternatives. `buildSuggestions` computes them
by simulating fixes and keeping the ones that actually resolve the violation:

- reduce a multi-scoop item by one scoop, and/or
- remove an individual product,

each verified against the limit before being offered. The kiosk renders them as one-tap
buttons, so "This exceeds the maximum caffeine amount" always comes with "You could choose
1 scoop of Static instead."

## Combination rules

`CombinationRule` rows are typed JSON configs evaluated by a registry, so new rule types are
plug-ins rather than rewrites. Shipped in v1:

| Type | Config | Effect |
|---|---|---|
| `MAX_PRODUCTS_PER_MIX` | `{ "max": 2 }` | Caps how many products can be mixed |
| `INCOMPATIBLE_TAGS` | `{ "tagSlugs": ["extreme-stim"], "message": "…" }` | Blocks mixing any product carrying a listed tag |

To add a rule type, add a branch to the evaluator in `safety.ts` and insert a row. Natural
next candidates: per-ingredient incompatibility pairs, time-of-day stimulant restrictions,
and age-gated products.

## Warnings

| Severity | Behavior on the kiosk |
|---|---|
| `INFO` | Shown for context |
| `CAUTION` | Shown prominently |
| `IMPORTANT` | **Must be acknowledged** before payment |
| `BLOCKING` | Prevents the transaction entirely |

Any warning may additionally set `requiresAcknowledgement`. Warnings merge across a mix and
de-duplicate by id, so mixing two caffeinated products shows one caffeine warning rather
than two.

The warning review screen makes each required warning a tappable confirmation, and the
Pay button stays disabled while any remain — it reads "Confirm N remaining" so the customer
knows exactly what is outstanding. Acknowledged ids are frozen onto the `SaleTransaction`,
producing a durable record of what the customer agreed to at purchase time.

`BLOCKING` is enforced server-side too: checkout rejects the order even if a client tries to
skip the review screen.

## Extending the engine

| Requirement | Where it goes |
|---|---|
| New limited ingredient | Insert an `IngredientLimit` row (admin UI) |
| Change a cap | Edit the row (admin UI) |
| New product warning | Insert `Warning` + `ProductWarning` rows |
| New *kind* of rule | New branch in the `CombinationRule` evaluator |
| Daily (cross-transaction) limits | Requires the future identity layer — see below |

## Known limitation: per-transaction, not per-day

Without customer identity, the machine can only enforce limits **per transaction**. Nothing
stops someone buying twice. Real daily-intake caps need the planned QR/loyalty identity
layer, at which point the same engine can accept a customer's rolling 24-hour total as
additional input. This is a documented product gap in v1, not an oversight — see the open
decisions in [ARCHITECTURE.md](./ARCHITECTURE.md#10-architectural-risks--open-product-decisions).

## Not medical advice

Ingredient copy is written plain-language-first and reviewed to avoid diagnosing, treating,
or guaranteeing outcomes. The quiz explains *why* it recommends a product using transparent,
inspectable rules rather than an opaque model. Dietary and allergen flags only surface on the
kiosk when `dietaryVerified` is set, so unverified metadata is never shown as fact.

Operators are responsible for configuring limits, warnings, and acknowledgement requirements
to match their manufacturer guidance and local regulatory obligations. **Someone must own
these numbers** — the software makes them easy to change and logs every change to the audit
trail, but it cannot choose them.
