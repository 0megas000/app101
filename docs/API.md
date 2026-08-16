# API Reference

Base URL `http://localhost:4000`. JSON in, JSON out. Two namespaces:

| Namespace | Auth | Consumer |
|---|---|---|
| `/api/kiosk/*` | none | The touchscreen on this machine |
| `/api/admin/*` | `Authorization: Bearer <token>` | Admin dashboard, future fleet tools |

The kiosk namespace is unauthenticated because physical presence at the machine *is* the
authorization, and the kiosk must keep serving customers when the network is down. It is
scoped to the single machine the server runs as (`MACHINE_SERIAL`), so it can never read or
mutate another machine's data.

Errors are `{ "error": string, "detail"?: unknown }` with a conventional status code.
All mutating endpoints validate their body with Zod.

---

## Kiosk

### `GET /api/kiosk/bootstrap`
Everything the kiosk needs at startup: machine identity, `settings` (idle timeout, attract
rotation, …), active `promotions` in playlist order, `education` topics, and the `tags`
that back the filter chips.

### `GET /api/kiosk/products`
Product cards for this machine. Availability is resolved against the machine's bins —
`available` is false when no bin holds the product, the bin is disabled, or it has less than
one serving left; `lowStock` is true below 20%.

### `GET /api/kiosk/products/:id`
A card plus `supplementFacts`, `majorIngredients` (the ones with `[?]` buttons),
`allIngredients`, and the product's `warnings`.

### `GET /api/kiosk/ingredients/:id`
The knowledge-base entry behind a `[?]` tap: `plainExplanation`, `sensation`,
`technicalExplanation` ("Learn more"), typical dose range, and `warningInfo`.

### `POST /api/kiosk/quote` — the safety endpoint

The single source of truth for what a selection costs and whether it is allowed.

```jsonc
// request
{ "items": [{ "productId": "…", "scoops": 2 }] }
```

```jsonc
// 200
{
  "allowed": false,
  "items":  [{ "productId": "…", "name": "Static", "scoops": 2,
               "lineTotalCents": 638, "gramsTarget": 26, … }],
  "totalCents": 638,
  "totalGrams": 26,
  "totals": [{ "ingredientId": "…", "name": "Caffeine", "amount": 400,
               "unit": "mg", "tracked": true }],
  "limits": [{ "ingredientName": "Caffeine", "amount": 400, "max": 300,
               "remaining": 0, "exceeded": true, "unit": "mg" }],
  "warnings": [{ "id": "…", "severity": "IMPORTANT", "title": "High caffeine content",
                 "body": "…", "requiresAcknowledgement": true }],
  "violations": [{
    "code": "LIMIT_CAFFEINE",
    "message": "This combination exceeds the maximum caffeine amount allowed for a single purchase (300 mg).",
    "suggestions": ["You could choose 1 scoop of Static instead."]
  }]
}
```

`limits` drives the progress meters; `violations[].suggestions` are rendered as one-tap fix
buttons. The kiosk calls this on every cart change and never computes totals itself.

### `POST /api/kiosk/orders`
```jsonc
{ "items": [{ "productId": "…", "scoops": 1 }],
  "acknowledgedWarningIds": ["…"],
  "sessionId": "uuid" }              // optional, anonymous
```

Re-runs `evaluateCart` server-side and rejects anything the quote would reject — the client
cannot bypass a limit by calling this directly. Then it verifies bin stock, checks cup
detection, charges through `PaymentService`, and starts the dispense job in the background.
Responds `201` with the order once payment succeeds.

| Status | Meaning |
|---|---|
| `422` | Safety violation, or a required warning was not acknowledged |
| `409` | Sold out, product unavailable on this machine, or no cup detected |
| `402` | Payment declined |

### `GET /api/kiosk/orders/:id`
Poll for live progress. `status` plus a `dispensing[]` array of per-item state
(`QUEUED`/`MEASURING`/`DISPENSING`/`READY`/`FAULTED`) with `gramsTarget`, `gramsActual`,
and any `error`.

### `POST /api/kiosk/quiz`
```jsonc
{ "energy": "MEDIUM", "caffeine": "NO", "tingle": "NO",
  "goal": "PUMP", "experience": "NEW" }
```
Returns up to 3 ranked recommendations, each with a `score` and human-readable `reasons`.
Transparent rule-based scoring — see [`server/src/services/quiz.ts`](../server/src/services/quiz.ts).

### `POST /api/kiosk/events`
Anonymous interaction analytics. `{ sessionId?, type, payload? }`, responds `202`.
Fire-and-forget from the client; failures never interrupt the customer.

Event types: `session_start`, `filter_applied`, `product_viewed`,
`ingredient_info_opened`, `products_compared`, `added_to_mix`, `quiz_started`,
`quiz_completed`, `limit_blocked`, `checkout_started`, `warnings_acknowledged`,
`payment_completed`, `payment_failed`, `session_timeout`.

---

## Admin

### `POST /api/admin/auth/login`
`{ "pin": "1234" }` → `{ token, name, role }`. Tokens last 8 hours.
`POST /api/admin/auth/logout` revokes the token. `GET /api/admin/me` returns the session.

Every route below requires `TECHNICIAN` or higher; the **Min role** column notes stricter
requirements. Roles rank `TECHNICIAN` < `GYM_MANAGER` < `BUSINESS_ADMIN` < `SUPER_ADMIN`.

### Dashboard & analytics

| Endpoint | Returns |
|---|---|
| `GET /overview` | Today/week/month revenue, transaction counts, average value, most popular product, lowest bin, open error count, fleet status |
| `GET /analytics/sales?days=30` | `daily`, `hourly`, and `weekday` revenue/count series |
| `GET /analytics/products` | Per-product revenue, purchases, 1-scoop vs 2-scoop split, mixed-purchase count |
| `GET /analytics/interactions` | Conversion funnel, event counters, top viewed products, top researched ingredients, common filter paths |

### Inventory

| Endpoint | Min role | Effect |
|---|---|---|
| `GET /inventory` | Technician | All bins with percent, estimated servings, low flag, lot, expiry |
| `POST /inventory/:binId/refill` | Technician | `{ grams, lotNumber? }` — clamps to capacity, writes a ledger row, a maintenance event, and an audit entry |
| `PATCH /inventory/:binId` | Gym Manager | `{ disabled?, lowThresholdGrams?, productId? }` |

### Catalog

| Endpoint | Min role |
|---|---|
| `GET /products`, `GET /products/meta` | Technician |
| `POST /products`, `PUT /products/:id` | Business Admin |
| `GET /ingredients`, `PUT /ingredients/:id` | Technician / Business Admin |
| `GET /warnings`, `PUT /warnings/:id` | Technician / Business Admin |

`products/meta` returns the brands, ingredients, warnings, and tags needed to populate the
editor. Creating or editing a product recomputes its denormalized caffeine value.

### Safety rules

| Endpoint | Min role | Effect |
|---|---|---|
| `GET /limits` | Technician | Ingredient limits + combination rules |
| `PUT /limits/:id` | Business Admin | `{ maxPerTransaction?, active?, note? }` |
| `PUT /rules/:id` | Business Admin | `{ active?, config? }` |

Changes take effect on the next quote — no restart, no deploy.

### Machines & maintenance

| Endpoint | Effect |
|---|---|
| `GET /machines` | Fleet with recent errors and maintenance history |
| `GET /machines/:id/health` | Live per-component health from `MachineStatusService` + active faults |
| `POST /machines/:id/faults` | `{ fault, active }` — inject/clear a simulated fault |
| `POST /machines/:id/test/:kind` | `dispenser` \| `scale` \| `sensor` \| `payment`; logs a maintenance event |
| `POST /machines/:id/errors/:errorId/resolve` | Mark an error resolved |

### Promotions, settings, audit

| Endpoint | Min role |
|---|---|
| `GET /promotions` | Technician |
| `POST /promotions`, `PUT /promotions/:id`, `DELETE /promotions/:id` | Gym Manager |
| `GET /settings` | Technician |
| `PUT /settings/:key` | Business Admin |
| `GET /audit?take=100` | Technician |

---

## WebSocket

Connect to `ws://localhost:4000/ws`. The server pushes:

```jsonc
{ "type": "inventory.updated", "binId": "…", "currentGrams": 8140, "percent": 81 }
{ "type": "machine.status",    "machineId": "…", "status": "ONLINE" }
{ "type": "order.updated",     "orderId": "…", "status": "COMPLETED" }
{ "type": "alert", "severity": "warning", "message": "Low inventory: bin 4 (18% remaining)" }
```

The admin dashboard renders `alert` frames as toasts and applies `inventory.updated` to the
inventory grid without a refetch. Clients reconnect automatically.

## Health

`GET /api/health` → `{ ok: true, machine: "PWX-001" }`.
