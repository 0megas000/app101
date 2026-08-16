/**
 * HardwareManager — composes one adapter set per machine.
 *
 * Swapping simulated hardware for real hardware means registering different
 * adapters here (e.g. from env/config): nothing above this layer changes.
 */
import type { HardwareSet } from "./types.js";
import {
  FaultInjector, SimulatedDispenserService, SimulatedInventorySensorService,
  SimulatedMachineStatusService, SimulatedPaymentService, SimulatedScaleService,
} from "./simulated.js";

class HardwareManager {
  readonly faults = new FaultInjector();
  private sets = new Map<string, HardwareSet>();

  forMachine(machineId: string): HardwareSet {
    let set = this.sets.get(machineId);
    if (!set) {
      set = {
        dispenser: new SimulatedDispenserService(this.faults),
        inventorySensor: new SimulatedInventorySensorService(this.faults),
        scale: new SimulatedScaleService(this.faults),
        payment: new SimulatedPaymentService(this.faults),
        status: new SimulatedMachineStatusService(this.faults),
      };
      this.sets.set(machineId, set);
    }
    return set;
  }
}

export const hardware = new HardwareManager();
