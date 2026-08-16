# Hardware Integration

The UI and business logic never touch a device. Everything goes through the interfaces in
[`server/src/hardware/types.ts`](../server/src/hardware/types.ts), resolved per machine by
the `HardwareManager`. Swapping simulated hardware for real hardware means registering
different adapters — no changes above that line.

```
routes → services (orders, safety) → HardwareManager → HardwareSet
                                                        ├── SimulatedDispenserService   (now)
                                                        └── SerialAugerDispenser         (later)
```

## The interfaces

| Interface | Contract |
|---|---|
| `DispenserService` | `dispense(request, onProgress?)` → `{ ok, gramsActual, errorCode?, errorMessage? }`; `selfTest(binNumber)` |
| `InventorySensorService` | `readBinWeightGrams(binId)` → grams, or `null` when the sensor is unreachable |
| `ScaleService` | `readGrams()`; `calibrate()` |
| `PaymentService` | `charge({ amountCents, reference })`; `selfTest()` |
| `MachineStatusService` | `health()` → per-component status; `isCupPresent()` |

Two contract details matter for real adapters:

- **`dispense` resolves rather than throws** on a mechanical fault, returning
  `ok: false` with a code. Faults are expected operating conditions, not exceptions.
- **`readBinWeightGrams` returns `null`** rather than throwing when a sensor is unreachable,
  so a dead sensor degrades to "unknown" instead of taking down the order path.

`onProgress` is invoked with `"MEASURING"` then `"DISPENSING"` so the order service can
persist each phase to `DispensingEvent` and the kiosk can animate real progress.

## The simulated adapters

[`server/src/hardware/simulated.ts`](../server/src/hardware/simulated.ts) models what real
hardware actually does:

- Measuring takes 1.2–1.8 s; dispensing runs at roughly 6 g/s (capped at 4 s for demos).
- Dispensed weight lands within ±2% of target, like a closed-loop auger and load cell.
- Payment authorization takes 1.4–2.2 s.
- Bin sensor readings carry ±3 g of noise around the database ledger value.

### Fault injection

A shared `FaultInjector` (owned by the `HardwareManager`, toggled from **Admin → Machines**
or `POST /api/admin/machines/:id/faults`) makes every failure path reachable without
hardware:

| Fault | Behavior |
|---|---|
| `DISPENSER_JAM` | `dispense` returns an auger-stall error mid-order; the order fails and the customer is told they weren't charged |
| `SENSOR_FAILURE` | `readBinWeightGrams` returns `null` |
| `SCALE_FAILURE` | `readGrams` throws; `calibrate` fails |
| `PAYMENT_FAILURE` | Every charge is declined |
| `CUP_MISSING` | `isCupPresent` is false, blocking checkout before payment |

`npm run test:e2e` exercises the customer-visible outcome of each one.

## Writing a real adapter

1. Implement the interface (nothing else needs to know how):

```ts
// server/src/hardware/real/serialAuger.ts
import type { DispenserService, DispenseRequest, DispenseResult } from "../types.js";

export class SerialAugerDispenser implements DispenserService {
  constructor(private port: SerialPort, private scale: ScaleService) {}

  async dispense(req: DispenseRequest, onProgress?): Promise<DispenseResult> {
    onProgress?.("MEASURING");
    await this.scale.tare();
    onProgress?.("DISPENSING");
    try {
      const grams = await this.runClosedLoop(req.binNumber, req.gramsTarget);
      return { ok: true, gramsActual: grams };
    } catch (err) {
      return { ok: false, gramsActual: 0, errorCode: "DISPENSER_JAM", errorMessage: String(err) };
    }
  }

  async selfTest(binNumber: number) { /* … */ }
}
```

2. Register it in [`manager.ts`](../server/src/hardware/manager.ts), typically behind an env
   flag so one build serves both bench and production machines:

```ts
const useReal = process.env.HARDWARE_MODE === "real";
set = {
  dispenser: useReal ? new SerialAugerDispenser(port, scale) : new SimulatedDispenserService(this.faults),
  // …
};
```

Nothing in `routes/`, `services/`, or `web/` changes.

## Deployment model

Each machine runs its own API server against a local PostgreSQL instance, because dispensing
must keep working when the WAN is down. The schema is already multi-tenant, so promoting a
central fleet backend is a deployment change rather than a rewrite. The machine → central
sync protocol is the main piece of future work and the platform's principal
distributed-systems risk.

## Recovery and auditability

Dispensing is a persisted state machine, not an in-memory promise: every item is a
`DispensingEvent` row moving `QUEUED → MEASURING → DISPENSING → READY | FAULTED`, with
`gramsTarget` and `gramsActual` both recorded. A machine that loses power mid-dispense
restarts with the exact state on disk, and every fault also lands in `MachineError` for the
maintenance screen.

Inventory is only decremented by the **actual** dispensed weight, after a successful
dispense — a jam never silently consumes stock.

## Roadmap

Interfaces exist today for dispensers, inventory sensors, scales, payment terminals, and
machine status. Still to be added — each a new interface behind the same pattern — are
QR/barcode scanners (loyalty and product lookup), lid and door sensors, and temperature
monitoring. Real card-present payments should use a **semi-integrated terminal** so card
data never touches the kiosk and PCI scope stays off this codebase.
