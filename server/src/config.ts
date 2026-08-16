export const config = {
  port: Number(process.env.PORT ?? 4000),
  machineSerial: process.env.MACHINE_SERIAL ?? "PWX-001",
  kioskIdleTimeoutSeconds: Number(process.env.KIOSK_IDLE_TIMEOUT_SECONDS ?? 60),
};
