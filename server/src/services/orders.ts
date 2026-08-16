/**
 * Order orchestration (spec §10, §12): quote → checkout → payment →
 * dispense state machine → inventory decrement → completion.
 *
 * Dispensing runs as a server-side background job persisted in
 * DispensingEvent rows, so the kiosk can poll order state and the flow is
 * recoverable/auditable.
 */
import { prisma } from "../lib/prisma.js";
import { hardware } from "../hardware/manager.js";
import { broadcast } from "../lib/ws.js";
import { evaluateCart, type CartItemInput } from "./safety.js";

export class OrderError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

export async function checkout(machineId: string, sessionId: string | undefined, itemsInput: CartItemInput[], acknowledgedWarningIds: string[]) {
  // Re-evaluate server-side — the client's quote is never trusted.
  const evaluation = await evaluateCart(itemsInput);
  if (!evaluation.allowed) {
    throw new OrderError(422, "This selection is not allowed.", { violations: evaluation.violations });
  }

  // Every warning that requires acknowledgement must have been acknowledged.
  const unacked = evaluation.warnings.filter((w) => (w.requiresAcknowledgement || w.severity === "IMPORTANT") && !acknowledgedWarningIds.includes(w.id));
  if (unacked.length > 0) {
    throw new OrderError(422, "Please review and acknowledge the product warnings before paying.", {
      unacknowledged: unacked.map((w) => ({ id: w.id, title: w.title })),
    });
  }

  // Verify inventory: each product needs an enabled bin with enough powder.
  const bins = await prisma.inventoryBin.findMany({
    where: { machineId, productId: { in: evaluation.items.map((i) => i.productId) }, disabled: false },
  });
  for (const item of evaluation.items) {
    const bin = bins.find((b) => b.productId === item.productId);
    if (!bin) throw new OrderError(409, `${item.name} is not available on this machine right now.`);
    if (bin.currentGrams < item.gramsTarget) {
      throw new OrderError(409, `${item.name} is sold out on this machine. Sorry!`);
    }
  }

  // Cup must be present before we take payment.
  const hw = hardware.forMachine(machineId);
  const cupPresent = await hw.status.isCupPresent();
  if (!cupPresent) {
    throw new OrderError(409, "No cup detected. Please place a cup in the bay and try again.");
  }

  const caffeine = evaluation.totals.find((t) => t.name === "Caffeine");
  const order = await prisma.saleTransaction.create({
    data: {
      machineId,
      kioskSessionId: sessionId,
      status: "PENDING_PAYMENT",
      totalCents: evaluation.totalCents,
      totalCaffeineMg: caffeine?.amount ?? 0,
      ingredientTotals: JSON.parse(JSON.stringify(evaluation.totals)),
      acknowledgedWarningIds,
      items: {
        create: evaluation.items.map((i) => ({
          productId: i.productId,
          scoops: i.scoops,
          unitPriceCents: i.unitPriceCents,
          gramsTarget: i.gramsTarget,
        })),
      },
    },
    include: { items: { include: { product: true } } },
  });

  // ── Payment (simulated adapter behind PaymentService) ──────────────
  const payment = await hw.payment.charge({ amountCents: order.totalCents, reference: `SIM-${order.id.slice(-8).toUpperCase()}` });
  if (!payment.ok) {
    await prisma.saleTransaction.update({ where: { id: order.id }, data: { status: "FAILED", failureReason: payment.errorMessage ?? "Payment declined" } });
    throw new OrderError(402, payment.errorMessage ?? "Payment declined. Please try another card.");
  }

  await prisma.saleTransaction.update({
    where: { id: order.id },
    data: { status: "DISPENSING", paymentMethod: payment.method, paymentRef: payment.transactionRef },
  });

  // Queue one dispensing event per item, then run the job without blocking
  // the HTTP response — the kiosk polls GET /orders/:id for live progress.
  for (const item of order.items) {
    const bin = bins.find((b) => b.productId === item.productId);
    await prisma.dispensingEvent.create({
      data: {
        transactionId: order.id,
        binId: bin?.id,
        productName: `${item.product.name} — ${item.product.flavor}`,
        status: "QUEUED",
        gramsTarget: item.gramsTarget,
      },
    });
  }
  void runDispenseJob(order.id, machineId).catch((err) => console.error("dispense job crashed", err));

  return getOrder(order.id);
}

async function runDispenseJob(orderId: string, machineId: string): Promise<void> {
  const hw = hardware.forMachine(machineId);
  const events = await prisma.dispensingEvent.findMany({ where: { transactionId: orderId }, orderBy: { createdAt: "asc" } });
  const binNumbers = new Map(
    (await prisma.inventoryBin.findMany({ where: { machineId }, select: { id: true, binNumber: true } }))
      .map((b) => [b.id, b.binNumber]),
  );
  let failed = false;

  for (const event of events) {
    await prisma.dispensingEvent.update({ where: { id: event.id }, data: { status: "MEASURING", startedAt: new Date() } });
    broadcast({ type: "order.updated", orderId, status: "DISPENSING" });

    const result = await hw.dispenser.dispense(
      {
        binId: event.binId ?? "",
        binNumber: event.binId ? binNumbers.get(event.binId) ?? 0 : 0,
        productName: event.productName,
        gramsTarget: event.gramsTarget,
      },
      (phase) => {
        void prisma.dispensingEvent.update({ where: { id: event.id }, data: { status: phase } }).catch(() => {});
      },
    );

    if (!result.ok) {
      failed = true;
      await prisma.dispensingEvent.update({
        where: { id: event.id },
        data: { status: "FAULTED", error: result.errorMessage, finishedAt: new Date() },
      });
      await prisma.machineError.create({
        data: { machineId, code: result.errorCode ?? "DISPENSE_FAILED", severity: "ERROR", message: result.errorMessage ?? "Dispense failed", component: "dispenser" },
      });
      broadcast({ type: "alert", severity: "error", message: `Dispense fault: ${result.errorMessage ?? "unknown"}` });
      break;
    }

    await prisma.dispensingEvent.update({
      where: { id: event.id },
      data: { status: "READY", gramsActual: result.gramsActual, finishedAt: new Date() },
    });

    // Decrement weight-tracked inventory + append to the inventory ledger.
    if (event.binId) {
      const bin = await prisma.inventoryBin.update({
        where: { id: event.binId },
        data: { currentGrams: { decrement: result.gramsActual } },
      });
      await prisma.inventoryTransaction.create({
        data: { binId: event.binId, type: "DISPENSE", deltaGrams: -result.gramsActual, note: `Order ${orderId}` },
      });
      const percent = Math.max(0, Math.round((bin.currentGrams / bin.capacityGrams) * 100));
      broadcast({ type: "inventory.updated", binId: bin.id, currentGrams: bin.currentGrams, percent });
      if (bin.currentGrams <= bin.lowThresholdGrams) {
        broadcast({ type: "alert", severity: "warning", message: `Low inventory: bin ${bin.binNumber} (${percent}% remaining)` });
      }
    }
  }

  await prisma.saleTransaction.update({
    where: { id: orderId },
    data: failed
      ? { status: "FAILED", failureReason: "Dispensing fault — payment will be refunded (simulated)" }
      : { status: "COMPLETED", completedAt: new Date() },
  });
  broadcast({ type: "order.updated", orderId, status: failed ? "FAILED" : "COMPLETED" });
}

export async function getOrder(orderId: string) {
  const order = await prisma.saleTransaction.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: { include: { brand: true } } } },
      dispensingEvents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) throw new OrderError(404, "Order not found");
  return {
    id: order.id,
    status: order.status,
    totalCents: order.totalCents,
    totalCaffeineMg: order.totalCaffeineMg,
    ingredientTotals: order.ingredientTotals,
    failureReason: order.failureReason,
    paymentRef: order.paymentRef,
    items: order.items.map((i) => ({
      productId: i.productId,
      brand: i.product.brand.name,
      name: i.product.name,
      flavor: i.product.flavor,
      scoops: i.scoops,
      lineTotalCents: i.unitPriceCents * i.scoops,
    })),
    dispensing: order.dispensingEvents.map((d) => ({
      productName: d.productName,
      status: d.status,
      gramsTarget: d.gramsTarget,
      gramsActual: d.gramsActual,
      error: d.error,
    })),
  };
}
