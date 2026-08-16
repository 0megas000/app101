/**
 * Kiosk API — unauthenticated (physical presence at the machine is the
 * authorization), scoped to the machine this server instance runs as.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { config } from "../config.js";
import { checkout, getOrder, OrderError } from "../services/orders.js";
import { evaluateCart } from "../services/safety.js";
import { recommend } from "../services/quiz.js";

export const kioskRouter = Router();

async function currentMachine() {
  const machine = await prisma.machine.findUnique({ where: { serial: config.machineSerial } });
  if (!machine) throw new Error(`Machine ${config.machineSerial} not found — did you run the seed?`);
  return machine;
}

const productCardSelect = {
  include: {
    brand: true,
    tags: { include: { tag: true } },
    ingredients: { include: { ingredient: true } },
    warnings: { include: { warning: true } },
  },
} as const;

function toCard(p: any, bin?: { currentGrams: number; capacityGrams: number; servingGrams: number; disabled: boolean }) {
  const available = bin ? !bin.disabled && bin.currentGrams >= p.servingSizeGrams : false;
  return {
    id: p.id,
    brand: p.brand.name,
    name: p.name,
    flavor: p.flavor,
    description: p.description,
    imageKey: p.imageKey,
    accentColor: p.accentColor,
    pricePerScoopCents: p.pricePerScoopCents,
    servingSizeGrams: p.servingSizeGrams,
    maxScoopsPerServing: p.maxScoopsPerServing,
    caffeineMgPerScoop: p.caffeineMgPerScoop,
    isStimulant: p.isStimulant,
    energyRating: p.energyRating,
    pumpRating: p.pumpRating,
    tingleRating: p.tingleRating,
    focusRating: p.focusRating,
    strength: p.strength,
    featured: p.featured,
    staffPick: p.staffPick,
    dietary: p.dietaryVerified ? { vegan: p.vegan, sugarFree: p.sugarFree, dyeFree: p.dyeFree } : null,
    tags: p.tags.map((t: any) => ({ slug: t.tag.slug, label: t.tag.label })),
    available,
    lowStock: bin ? !bin.disabled && bin.currentGrams / bin.capacityGrams < 0.2 : false,
  };
}

kioskRouter.get("/bootstrap", async (_req, res) => {
  const machine = await currentMachine();
  const [settings, promotions, education, tags] = await Promise.all([
    prisma.systemSetting.findMany(),
    prisma.promotion.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.educationTopic.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.tag.findMany({ orderBy: { label: "asc" } }),
  ]);
  res.json({
    machine: { id: machine.id, serial: machine.serial, name: machine.name },
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
    promotions,
    education,
    tags: tags.map((t) => ({ slug: t.slug, label: t.label })),
  });
});

kioskRouter.get("/products", async (_req, res) => {
  const machine = await currentMachine();
  const [products, bins] = await Promise.all([
    prisma.product.findMany({ where: { active: true }, ...productCardSelect, orderBy: { name: "asc" } }),
    prisma.inventoryBin.findMany({ where: { machineId: machine.id } }),
  ]);
  res.json(
    products.map((p) => {
      const bin = bins.find((b) => b.productId === p.id);
      return toCard(p, bin ? { currentGrams: bin.currentGrams, capacityGrams: bin.capacityGrams, servingGrams: p.servingSizeGrams, disabled: bin.disabled } : undefined);
    }),
  );
});

kioskRouter.get("/products/:id", async (req, res) => {
  const machine = await currentMachine();
  const p = await prisma.product.findUnique({ where: { id: req.params.id }, ...productCardSelect });
  if (!p || !p.active) return res.status(404).json({ error: "Product not found" });
  const bin = await prisma.inventoryBin.findFirst({ where: { machineId: machine.id, productId: p.id } });
  res.json({
    ...toCard(p, bin ? { currentGrams: bin.currentGrams, capacityGrams: bin.capacityGrams, servingGrams: p.servingSizeGrams, disabled: bin.disabled } : undefined),
    supplementFacts: p.supplementFacts,
    majorIngredients: p.ingredients
      .filter((pi) => pi.major)
      .map((pi) => ({
        ingredientId: pi.ingredientId,
        name: pi.ingredient.name,
        amountPerScoop: pi.amountPerScoop,
        unit: pi.ingredient.unit,
        category: pi.ingredient.category,
      })),
    allIngredients: p.ingredients.map((pi) => ({
      ingredientId: pi.ingredientId,
      name: pi.ingredient.name,
      amountPerScoop: pi.amountPerScoop,
      unit: pi.ingredient.unit,
      major: pi.major,
    })),
    warnings: p.warnings
      .filter((pw) => pw.warning.active)
      .map((pw) => ({
        id: pw.warning.id,
        severity: pw.warning.severity,
        title: pw.warning.title,
        body: pw.warning.body,
      })),
  });
});

kioskRouter.get("/ingredients/:id", async (req, res) => {
  const ing = await prisma.ingredient.findUnique({ where: { id: req.params.id } });
  if (!ing) return res.status(404).json({ error: "Ingredient not found" });
  res.json(ing);
});

const cartSchema = z.object({
  items: z.array(z.object({ productId: z.string().min(1), scoops: z.number().int().min(1).max(4) })).min(1).max(6),
});

kioskRouter.post("/quote", async (req, res) => {
  const parsed = cartSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid cart", detail: parsed.error.flatten() });
  res.json(await evaluateCart(parsed.data.items));
});

const orderSchema = cartSchema.extend({
  sessionId: z.string().uuid().optional(),
  acknowledgedWarningIds: z.array(z.string()).default([]),
});

kioskRouter.post("/orders", async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid order", detail: parsed.error.flatten() });
  try {
    const machine = await currentMachine();
    const order = await checkout(machine.id, parsed.data.sessionId, parsed.data.items, parsed.data.acknowledgedWarningIds);
    res.status(201).json(order);
  } catch (err) {
    if (err instanceof OrderError) return res.status(err.status).json({ error: err.message, detail: err.detail });
    throw err;
  }
});

kioskRouter.get("/orders/:id", async (req, res) => {
  try {
    res.json(await getOrder(req.params.id));
  } catch (err) {
    if (err instanceof OrderError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

const quizSchema = z.object({
  energy: z.enum(["LOW", "MEDIUM", "HIGH"]),
  caffeine: z.enum(["YES", "NO"]),
  tingle: z.enum(["YES", "NO", "NOT_SURE"]),
  goal: z.enum(["ENERGY", "PUMP", "FOCUS", "PERFORMANCE"]),
  experience: z.enum(["NEW", "SOME", "EXPERIENCED"]),
});

kioskRouter.post("/quiz", async (req, res) => {
  const parsed = quizSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid answers" });
  res.json(await recommend(parsed.data));
});

// Anonymous interaction analytics ingest (no PII, spec §16)
const eventSchema = z.object({
  sessionId: z.string().uuid().optional(),
  type: z.string().min(1).max(64),
  payload: z.record(z.unknown()).optional(),
});

kioskRouter.post("/events", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid event" });
  const machine = await currentMachine();
  await prisma.analyticsEvent.create({
    data: {
      machineId: machine.id,
      sessionId: parsed.data.sessionId,
      type: parsed.data.type,
      payload: parsed.data.payload ? JSON.parse(JSON.stringify(parsed.data.payload)) : undefined,
    },
  });
  res.status(202).json({ ok: true });
});
