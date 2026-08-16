/**
 * Simulated hardware adapters (spec §11, §23).
 *
 * Models realistic timing, measurement noise, and injectable faults so the
 * whole UI/error-handling path can be exercised without physical hardware.
 */
import type {
  ComponentHealth, DispenseRequest, DispenseResult, DispenserService,
  InventorySensorService, MachineStatusService, PaymentRequest, PaymentResult,
  PaymentService, ScaleService, SimulatedFault,
} from "./types.js";
import { prisma } from "../lib/prisma.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Shared fault-injection state, toggled from the admin Maintenance screen. */
export class FaultInjector {
  private faults = new Set<SimulatedFault>();

  set(fault: SimulatedFault, active: boolean): void {
    if (active) this.faults.add(fault);
    else this.faults.delete(fault);
  }
  has(fault: SimulatedFault): boolean {
    return this.faults.has(fault);
  }
  list(): SimulatedFault[] {
    return [...this.faults];
  }
  clear(): void {
    this.faults.clear();
  }
}

export class SimulatedDispenserService implements DispenserService {
  constructor(private injector: FaultInjector) {}

  async dispense(request: DispenseRequest, onProgress?: (phase: "MEASURING" | "DISPENSING") => void): Promise<DispenseResult> {
    onProgress?.("MEASURING");
    await sleep(1200 + Math.random() * 600);

    if (this.injector.has("DISPENSER_JAM")) {
      return { ok: false, gramsActual: 0, errorCode: "DISPENSER_JAM", errorMessage: `Auger stall detected on bin ${request.binNumber}` };
    }

    onProgress?.("DISPENSING");
    // Auger speed ≈ 6 g/sec, capped so the demo stays snappy
    await sleep(Math.min(4000, (request.gramsTarget / 6) * 1000));

    // ±2% measurement/dispense tolerance, like a real auger + load cell loop
    const gramsActual = Math.round(request.gramsTarget * (0.98 + Math.random() * 0.04) * 10) / 10;
    return { ok: true, gramsActual };
  }

  async selfTest(binNumber: number): Promise<{ ok: boolean; message: string }> {
    await sleep(900);
    if (this.injector.has("DISPENSER_JAM")) {
      return { ok: false, message: `Bin ${binNumber}: auger did not reach target speed (simulated jam active)` };
    }
    return { ok: true, message: `Bin ${binNumber}: auger cycled 2 revolutions, current draw nominal` };
  }
}

export class SimulatedInventorySensorService implements InventorySensorService {
  constructor(private injector: FaultInjector) {}

  async readBinWeightGrams(binId: string): Promise<number | null> {
    await sleep(150);
    if (this.injector.has("SENSOR_FAILURE")) return null;
    // The simulation's ground truth is the database ledger, plus sensor noise.
    const bin = await prisma.inventoryBin.findUnique({ where: { id: binId } });
    if (!bin) return null;
    return Math.max(0, Math.round(bin.currentGrams + (Math.random() * 6 - 3)));
  }
}

export class SimulatedScaleService implements ScaleService {
  constructor(private injector: FaultInjector) {}

  async readGrams(): Promise<number> {
    await sleep(120);
    if (this.injector.has("SCALE_FAILURE")) throw new Error("SCALE_FAILURE: load cell not responding");
    return Math.round(Math.random() * 3 * 10) / 10; // empty-cup noise
  }

  async calibrate(): Promise<{ ok: boolean; message: string }> {
    await sleep(1500);
    if (this.injector.has("SCALE_FAILURE")) {
      return { ok: false, message: "Calibration failed: load cell not responding (simulated fault active)" };
    }
    return { ok: true, message: "Scale calibrated: zero offset 0.2 g, span factor 1.003" };
  }
}

export class SimulatedPaymentService implements PaymentService {
  constructor(private injector: FaultInjector) {}

  async charge(request: PaymentRequest): Promise<PaymentResult> {
    await sleep(1400 + Math.random() * 800);
    if (this.injector.has("PAYMENT_FAILURE")) {
      return { ok: false, method: "SIMULATED_CARD", transactionRef: request.reference, errorMessage: "Card declined (simulated failure active)" };
    }
    return { ok: true, method: "SIMULATED_CARD", transactionRef: request.reference };
  }

  async selfTest(): Promise<{ ok: boolean; message: string }> {
    await sleep(700);
    if (this.injector.has("PAYMENT_FAILURE")) return { ok: false, message: "Payment terminal: no response (simulated fault active)" };
    return { ok: true, message: "Payment terminal: handshake OK, simulated processor reachable" };
  }
}

export class SimulatedMachineStatusService implements MachineStatusService {
  constructor(private injector: FaultInjector) {}

  async health(): Promise<ComponentHealth[]> {
    return [
      { component: "dispenser", ok: !this.injector.has("DISPENSER_JAM"), detail: this.injector.has("DISPENSER_JAM") ? "Auger jam (simulated)" : "All augers nominal" },
      { component: "inventory-sensors", ok: !this.injector.has("SENSOR_FAILURE"), detail: this.injector.has("SENSOR_FAILURE") ? "Bin sensors offline (simulated)" : "All bin sensors reporting" },
      { component: "scale", ok: !this.injector.has("SCALE_FAILURE"), detail: this.injector.has("SCALE_FAILURE") ? "Load cell not responding (simulated)" : "Load cell nominal" },
      { component: "payment", ok: !this.injector.has("PAYMENT_FAILURE"), detail: this.injector.has("PAYMENT_FAILURE") ? "Terminal offline (simulated)" : "Terminal connected" },
      { component: "cup-detection", ok: !this.injector.has("CUP_MISSING"), detail: this.injector.has("CUP_MISSING") ? "Cup sensor reports empty bay (simulated)" : "Cup bay sensor nominal" },
      { component: "network", ok: true, detail: "Connected" },
    ];
  }

  async isCupPresent(): Promise<boolean> {
    return !this.injector.has("CUP_MISSING");
  }
}
