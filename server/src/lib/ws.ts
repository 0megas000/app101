/**
 * WebSocket hub — pushes real-time updates (inventory, machine status,
 * order progress, admin alerts) to connected kiosk and admin clients.
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

let wss: WebSocketServer | null = null;

export function initWs(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "hello", at: new Date().toISOString() }));
  });
}

export type WsMessage =
  | { type: "inventory.updated"; binId: string; currentGrams: number; percent: number }
  | { type: "machine.status"; machineId: string; status: string }
  | { type: "order.updated"; orderId: string; status: string }
  | { type: "alert"; severity: "info" | "warning" | "error"; message: string };

export function broadcast(message: WsMessage): void {
  if (!wss) return;
  const data = JSON.stringify({ ...message, at: new Date().toISOString() });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}
