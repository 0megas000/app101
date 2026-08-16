/**
 * Admin API — PIN login → bearer token, role-gated, mutations audited.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { loginWithPin, logout, requireRole, audit, type AuthedRequest } from "../lib/auth.js";
import { hardware } from "../hardware/manager.js";
import { broadcast } from "../lib/ws.js";
import { interactionFunnel, productPerformance, salesOverview, salesSeries } from "../services/analytics.js";
import type { SimulatedFault } from "../hardware/types.js";

export const adminRouter = Router();

// ── Auth ─────────────────────────────────────────────────────────────
adminRouter.post("/auth/login", async (req, res) => {
  const parsed = z.object({ pin: z.string().min(4).max(12) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid PIN format" });
  const session = await loginWithPin(parsed.data.pin);
  if (!session) return res.status(401).json({ error: "Incorrect PIN" });
  res.json(session);
});

adminRouter.post("/auth/logout", (req, res) => {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) logout(header.slice(7));
  res.json({ ok: true });
});

// Everything below requires at least TECHNICIAN
adminRouter.use(requireRole("TECHNICIAN"));

adminRouter.get("/me", (req: AuthedRequest, res) => res.json(req.auth));

// ── Dashboard & analytics ────────────────────────────────────────────
adminRouter.get("/overview", async (_req, res) => {
  const [sales, machines, openErrors] = await Promise.all([
    salesOverview(),
    prisma.machine.findMany({ include: { location: { include: { gym: true } } } }),
    prisma.machineError.count({ where: { resolvedAt: null } }),
  ]);
  res.json({
    ...sales,
    openErrors,
    machines: machines.map((m) => ({ id: m.id, serial: m.serial, name: m.name, status: m.status, gym: m.location.gym.name })),
  });
});

adminRouter.get("/analytics/sales", async (req, res) => {
  const days = Math.min(90, Math.max(1, Number(req.query.days ?? 30)));
  res.json(await salesSeries(days));
});

adminRouter.get("/analytics/products", async (_req, res) => {
  res.json(await productPerformance());
});

adminRouter.get("/analytics/interactions", async (_req, res) => {
  res.json(await interactionFunnel());
});

// ── Inventory ────────────────────────────────────────────────────────
adminRouter.get("/inventory", async (_req, res) => {
  const bins = await prisma.inventoryBin.findMany({
    include: { product: { include: { brand: true } }, machine: true },
    orderBy: [{ machineId: "asc" }, { binNumber: "asc" }],
  });
  res.json(
    bins.map((b) => ({
      id: b.id,
      machine: b.machine.serial,
      binNumber: b.binNumber,
      product: b.product ? { id: b.product.id, name: b.product.name, brand: b.product.brand.name, flavor: b.product.flavor, servingSizeGrams: b.product.servingSizeGrams, accentColor: b.product.accentColor } : null,
      capacityGrams: b.capacityGrams,
      currentGrams: b.currentGrams,
      percent: Math.max(0, Math.round((b.currentGrams / b.capacityGrams) * 100)),
      estimatedServings: b.product ? Math.floor(b.currentGrams / b.product.servingSizeGrams) : null,
      low: b.currentGrams <= b.lowThresholdGrams,
      lowThresholdGrams: b.lowThresholdGrams,
      lotNumber: b.lotNumber,
      expiresAt: b.expiresAt,
      lastRefillAt: b.lastRefillAt,
      disabled: b.disabled,
    })),
  );
});

adminRouter.post("/inventory/:binId/refill", async (req: AuthedRequest, res) => {
  const parsed = z.object({ grams: z.number().positive().max(50000), lotNumber: z.string().max(64).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid refill" });
  const bin = await prisma.inventoryBin.findUnique({ where: { id: req.params.binId } });
  if (!bin) return res.status(404).json({ error: "Bin not found" });
  const newGrams = Math.min(bin.capacityGrams, bin.currentGrams + parsed.data.grams);
  const updated = await prisma.inventoryBin.update({
    where: { id: bin.id },
    data: { currentGrams: newGrams, lastRefillAt: new Date(), ...(parsed.data.lotNumber ? { lotNumber: parsed.data.lotNumber } : {}) },
  });
  await prisma.inventoryTransaction.create({
    data: { binId: bin.id, type: "REFILL", deltaGrams: newGrams - bin.currentGrams, note: `Refill by ${req.auth?.name}` },
  });
  await prisma.maintenanceEvent.create({
    data: { machineId: bin.machineId, kind: "REFILL", note: `Bin ${bin.binNumber} +${Math.round(newGrams - bin.currentGrams)} g`, performedBy: req.auth?.name },
  });
  await audit(req, "inventory.refill", "InventoryBin", bin.id, { grams: parsed.data.grams });
  broadcast({ type: "inventory.updated", binId: bin.id, currentGrams: updated.currentGrams, percent: Math.round((updated.currentGrams / updated.capacityGrams) * 100) });
  res.json({ ok: true, currentGrams: updated.currentGrams });
});

adminRouter.patch("/inventory/:binId", requireRole("GYM_MANAGER"), async (req: AuthedRequest, res) => {
  const parsed = z.object({
    disabled: z.boolean().optional(),
    lowThresholdGrams: z.number().min(0).optional(),
    productId: z.string().nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid update" });
  const updated = await prisma.inventoryBin.update({ where: { id: req.params.binId }, data: parsed.data });
  await audit(req, "inventory.update", "InventoryBin", updated.id, parsed.data);
  res.json({ ok: true });
});

// ── Product management (BUSINESS_ADMIN+) ─────────────────────────────
const productSchema = z.object({
  name: z.string().min(1).max(80),
  flavor: z.string().min(1).max(80),
  brandId: z.string(),
  description: z.string().max(2000),
  pricePerScoopCents: z.number().int().min(0),
  servingSizeGrams: z.number().positive(),
  maxScoopsPerServing: z.number().int().min(1).max(4),
  isStimulant: z.boolean(),
  energyRating: z.number().int().min(0).max(5),
  pumpRating: z.number().int().min(0).max(5),
  tingleRating: z.number().int().min(0).max(5),
  focusRating: z.number().int().min(0).max(5),
  strength: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  featured: z.boolean(),
  staffPick: z.boolean(),
  active: z.boolean(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  imageKey: z.string().max(32),
  ingredients: z.array(z.object({ ingredientId: z.string(), amountPerScoop: z.number().positive(), major: z.boolean() })),
  warningIds: z.array(z.string()),
  tagSlugs: z.array(z.string()),
});

adminRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { brand: true, ingredients: { include: { ingredient: true } }, warnings: true, tags: { include: { tag: true } } },
    orderBy: { name: "asc" },
  });
  res.json(products);
});

adminRouter.get("/products/meta", async (_req, res) => {
  const [brands, ingredients, warnings, tags] = await Promise.all([
    prisma.brand.findMany({ orderBy: { name: "asc" } }),
    prisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    prisma.warning.findMany({ orderBy: { code: "asc" } }),
    prisma.tag.findMany({ orderBy: { label: "asc" } }),
  ]);
  res.json({ brands, ingredients, warnings, tags });
});

adminRouter.put("/products/:id", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = productSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid product", detail: parsed.error.flatten() });
  const { ingredients, warningIds, tagSlugs, ...fields } = parsed.data;
  // Recompute the denormalized caffeine column from the ingredient list.
  let caffeineMgPerScoop: number | undefined;
  if (ingredients) {
    const caffeineRow = await prisma.ingredient.findUnique({ where: { name: "Caffeine" } });
    caffeineMgPerScoop = ingredients.find((i) => i.ingredientId === caffeineRow?.id)?.amountPerScoop ?? 0;
  }
  const updated = await prisma.product.update({
    where: { id: req.params.id },
    data: {
      ...fields,
      ...(caffeineMgPerScoop !== undefined ? { caffeineMgPerScoop } : {}),
      ...(ingredients ? { ingredients: { deleteMany: {}, create: ingredients.map((i) => ({ ingredientId: i.ingredientId, amountPerScoop: i.amountPerScoop, major: i.major })) } } : {}),
      ...(warningIds ? { warnings: { deleteMany: {}, create: warningIds.map((warningId) => ({ warningId })) } } : {}),
      ...(tagSlugs ? { tags: { deleteMany: {}, create: await tagConnects(tagSlugs) } } : {}),
    },
  });
  await audit(req, "product.update", "Product", updated.id, parsed.data);
  res.json({ ok: true });
});

adminRouter.post("/products", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = productSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid product", detail: parsed.error.flatten() });
  const { ingredients, warningIds, tagSlugs, ...fields } = parsed.data;
  const org = await prisma.organization.findFirstOrThrow();
  const caffeineRow = await prisma.ingredient.findUnique({ where: { name: "Caffeine" } });
  const created = await prisma.product.create({
    data: {
      ...fields,
      organizationId: org.id,
      caffeineMgPerScoop: ingredients.find((i) => i.ingredientId === caffeineRow?.id)?.amountPerScoop ?? 0,
      supplementFacts: [],
      ingredients: { create: ingredients.map((i) => ({ ingredientId: i.ingredientId, amountPerScoop: i.amountPerScoop, major: i.major })) },
      warnings: { create: warningIds.map((warningId) => ({ warningId })) },
      tags: { create: await tagConnects(tagSlugs) },
    },
  });
  await audit(req, "product.create", "Product", created.id, { name: created.name });
  res.status(201).json({ id: created.id });
});

async function tagConnects(slugs: string[]) {
  const tags = await prisma.tag.findMany({ where: { slug: { in: slugs } } });
  return tags.map((t) => ({ tagId: t.id }));
}

// ── Ingredient management ────────────────────────────────────────────
adminRouter.get("/ingredients", async (_req, res) => {
  res.json(await prisma.ingredient.findMany({ orderBy: { name: "asc" }, include: { limits: true } }));
});

adminRouter.put("/ingredients/:id", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = z.object({
    plainExplanation: z.string().max(2000).optional(),
    sensation: z.string().max(2000).optional(),
    technicalExplanation: z.string().max(4000).optional(),
    warningInfo: z.string().max(2000).nullable().optional(),
    typicalDoseMin: z.number().min(0).optional(),
    typicalDoseMax: z.number().min(0).optional(),
    tracked: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid ingredient update" });
  const updated = await prisma.ingredient.update({ where: { id: req.params.id }, data: parsed.data });
  await audit(req, "ingredient.update", "Ingredient", updated.id, parsed.data);
  res.json({ ok: true });
});

// ── Warnings & safety rules ──────────────────────────────────────────
adminRouter.get("/warnings", async (_req, res) => {
  res.json(await prisma.warning.findMany({ orderBy: { code: "asc" }, include: { products: { include: { product: true } } } }));
});

adminRouter.put("/warnings/:id", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = z.object({
    title: z.string().max(120).optional(),
    body: z.string().max(2000).optional(),
    severity: z.enum(["INFO", "CAUTION", "IMPORTANT", "BLOCKING"]).optional(),
    requiresAcknowledgement: z.boolean().optional(),
    active: z.boolean().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid warning update" });
  const updated = await prisma.warning.update({ where: { id: req.params.id }, data: parsed.data });
  await audit(req, "warning.update", "Warning", updated.id, parsed.data);
  res.json({ ok: true });
});

adminRouter.get("/limits", async (_req, res) => {
  const [limits, rules] = await Promise.all([
    prisma.ingredientLimit.findMany({ include: { ingredient: true } }),
    prisma.combinationRule.findMany(),
  ]);
  res.json({ limits, rules });
});

adminRouter.put("/limits/:id", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = z.object({
    maxPerTransaction: z.number().positive().optional(),
    active: z.boolean().optional(),
    note: z.string().max(500).nullable().optional(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid limit update" });
  const updated = await prisma.ingredientLimit.update({ where: { id: req.params.id }, data: parsed.data });
  await audit(req, "limit.update", "IngredientLimit", updated.id, parsed.data);
  res.json({ ok: true });
});

adminRouter.put("/rules/:id", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const parsed = z.object({ active: z.boolean().optional(), config: z.record(z.unknown()).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid rule update" });
  const updated = await prisma.combinationRule.update({
    where: { id: req.params.id },
    data: { ...(parsed.data.active !== undefined ? { active: parsed.data.active } : {}), ...(parsed.data.config ? { config: JSON.parse(JSON.stringify(parsed.data.config)) } : {}) },
  });
  await audit(req, "rule.update", "CombinationRule", updated.id, parsed.data);
  res.json({ ok: true });
});

// ── Machines, status & maintenance ───────────────────────────────────
adminRouter.get("/machines", async (_req, res) => {
  const machines = await prisma.machine.findMany({
    include: {
      location: { include: { gym: { include: { organization: true } } } },
      errors: { orderBy: { createdAt: "desc" }, take: 20 },
      maintenance: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  res.json(machines);
});

adminRouter.get("/machines/:id/health", async (req, res) => {
  const hw = hardware.forMachine(req.params.id);
  res.json({ components: await hw.status.health(), activeFaults: hardware.faults.list() });
});

const faultSchema = z.object({
  fault: z.enum(["DISPENSER_JAM", "SENSOR_FAILURE", "SCALE_FAILURE", "PAYMENT_FAILURE", "CUP_MISSING"]),
  active: z.boolean(),
});

adminRouter.post("/machines/:id/faults", async (req: AuthedRequest, res) => {
  const parsed = faultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid fault" });
  hardware.faults.set(parsed.data.fault as SimulatedFault, parsed.data.active);
  await audit(req, "maintenance.simulate_fault", "Machine", req.params.id, parsed.data);
  broadcast({ type: "alert", severity: parsed.data.active ? "warning" : "info", message: `Simulated fault ${parsed.data.fault} ${parsed.data.active ? "ENABLED" : "cleared"}` });
  res.json({ activeFaults: hardware.faults.list() });
});

adminRouter.post("/machines/:id/test/:kind", async (req: AuthedRequest, res) => {
  const machineId = req.params.id ?? "";
  const hw = hardware.forMachine(machineId);
  const kind = req.params.kind ?? "";
  let result: { ok: boolean; message: string };
  if (kind === "dispenser") result = await hw.dispenser.selfTest(Number(req.query.bin ?? 1));
  else if (kind === "scale") result = await hw.scale.calibrate();
  else if (kind === "payment") result = await hw.payment.selfTest();
  else if (kind === "sensor") {
    const bin = await prisma.inventoryBin.findFirst({ where: { machineId } });
    const reading = bin ? await hw.inventorySensor.readBinWeightGrams(bin.id) : null;
    result = reading === null ? { ok: false, message: "Sensor read failed" } : { ok: true, message: `Bin ${bin?.binNumber}: sensor reads ${reading} g` };
  } else return res.status(400).json({ error: "Unknown test" });

  await prisma.maintenanceEvent.create({
    data: { machineId, kind: `${kind.toUpperCase()}_TEST`, note: result.message, performedBy: req.auth?.name },
  });
  await audit(req, `maintenance.test.${kind}`, "Machine", machineId, result);
  res.json(result);
});

adminRouter.post("/machines/:id/errors/:errorId/resolve", async (req: AuthedRequest, res) => {
  await prisma.machineError.update({ where: { id: req.params.errorId }, data: { resolvedAt: new Date() } });
  await audit(req, "error.resolve", "MachineError", req.params.errorId);
  res.json({ ok: true });
});

// ── Promotions / idle screen ─────────────────────────────────────────
adminRouter.get("/promotions", async (_req, res) => {
  res.json(await prisma.promotion.findMany({ orderBy: { sortOrder: "asc" } }));
});

const promoSchema = z.object({
  kind: z.enum(["MESSAGE", "PRODUCT_FEATURE", "PROMO"]),
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).nullable().optional(),
  productId: z.string().nullable().optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
});

adminRouter.post("/promotions", requireRole("GYM_MANAGER"), async (req: AuthedRequest, res) => {
  const parsed = promoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid promotion" });
  const created = await prisma.promotion.create({ data: parsed.data });
  await audit(req, "promotion.create", "Promotion", created.id, parsed.data);
  res.status(201).json(created);
});

adminRouter.put("/promotions/:id", requireRole("GYM_MANAGER"), async (req: AuthedRequest, res) => {
  const parsed = promoSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid promotion" });
  const updated = await prisma.promotion.update({ where: { id: req.params.id }, data: parsed.data });
  await audit(req, "promotion.update", "Promotion", updated.id, parsed.data);
  res.json(updated);
});

adminRouter.delete("/promotions/:id", requireRole("GYM_MANAGER"), async (req: AuthedRequest, res) => {
  await prisma.promotion.delete({ where: { id: req.params.id } });
  await audit(req, "promotion.delete", "Promotion", req.params.id);
  res.json({ ok: true });
});

// ── Settings & audit log ─────────────────────────────────────────────
adminRouter.get("/settings", async (_req, res) => {
  const settings = await prisma.systemSetting.findMany();
  res.json(Object.fromEntries(settings.map((s) => [s.key, s.value])));
});

adminRouter.put("/settings/:key", requireRole("BUSINESS_ADMIN"), async (req: AuthedRequest, res) => {
  const key = req.params.key ?? "";
  const parsed = z.object({ value: z.unknown() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid setting" });
  const value = JSON.parse(JSON.stringify(parsed.data.value));
  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  await audit(req, "setting.update", "SystemSetting", key, { value });
  res.json({ ok: true });
});

adminRouter.get("/audit", async (req, res) => {
  const take = Math.min(200, Number(req.query.take ?? 100));
  res.json(await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take, include: { user: { select: { name: true, role: true } } } }));
});
