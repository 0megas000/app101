import { createServer } from "node:http";
import express from "express";
import { config } from "./config.js";
import { prisma } from "./lib/prisma.js";
import { initWs } from "./lib/ws.js";
import { kioskRouter } from "./routes/kiosk.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
app.use(express.json({ limit: "256kb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, machine: config.machineSerial }));
app.use("/api/kiosk", kioskRouter);
app.use("/api/admin", adminRouter);

// Central error handler — never leak internals to the kiosk
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const server = createServer(app);
initWs(server);

// Heartbeat: mark this machine online periodically (real machines would
// report to the central backend; here we update the row directly).
async function heartbeat() {
  try {
    await prisma.machine.update({
      where: { serial: config.machineSerial },
      data: { lastHeartbeatAt: new Date(), status: "ONLINE" },
    });
  } catch {
    // seed not run yet — ignore
  }
}
setInterval(heartbeat, 30_000);

server.listen(config.port, () => {
  void heartbeat();
  console.log(`API server (machine ${config.machineSerial}) listening on http://localhost:${config.port}`);
});
