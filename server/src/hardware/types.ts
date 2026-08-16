/**
 * Hardware Abstraction Layer — interfaces (spec §11).
 *
 * The UI and business logic never touch hardware directly; they call these
 * interfaces through the HardwareManager. The prototype registers Simulated*
 * implementations. Real adapters (serial augers, HX711 load cells, EMV
 * payment terminals, GPIO sensors) implement the same contracts.
 */

export interface DispenseRequest {
  binId: string;
  binNumber: number;
  productName: string;
  gramsTarget: number;
}

export interface DispenseResult {
  ok: boolean;
  gramsActual: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface DispenserService {
  /** Dispense powder from a bin. Resolves when the mechanism finishes or faults. */
  dispense(request: DispenseRequest, onProgress?: (phase: "MEASURING" | "DISPENSING") => void): Promise<DispenseResult>;
  /** Run a no-product mechanical self test. */
  selfTest(binNumber: number): Promise<{ ok: boolean; message: string }>;
}

export interface InventorySensorService {
  /** Read the sensed remaining weight in a bin (load-cell or level sensor). */
  readBinWeightGrams(binId: string): Promise<number | null>;
}

export interface ScaleService {
  /** Read the cup/output scale. */
  readGrams(): Promise<number>;
  calibrate(): Promise<{ ok: boolean; message: string }>;
}

export interface PaymentRequest {
  amountCents: number;
  reference: string;
}

export interface PaymentResult {
  ok: boolean;
  method: string;
  transactionRef: string;
  errorMessage?: string;
}

export interface PaymentService {
  charge(request: PaymentRequest): Promise<PaymentResult>;
  selfTest(): Promise<{ ok: boolean; message: string }>;
}

export interface ComponentHealth {
  component: string;
  ok: boolean;
  detail: string;
}

export interface MachineStatusService {
  health(): Promise<ComponentHealth[]>;
  /** Sensors like cup detection — the kiosk asks before dispensing. */
  isCupPresent(): Promise<boolean>;
}

/** Fault types that can be injected into the simulated hardware (spec §23). */
export type SimulatedFault =
  | "DISPENSER_JAM"
  | "SENSOR_FAILURE"
  | "SCALE_FAILURE"
  | "PAYMENT_FAILURE"
  | "CUP_MISSING";

export interface HardwareSet {
  dispenser: DispenserService;
  inventorySensor: InventorySensorService;
  scale: ScaleService;
  payment: PaymentService;
  status: MachineStatusService;
}
