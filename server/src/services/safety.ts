/**
 * Safety / ingredient-limit engine (spec §7, §8, §9, §26).
 *
 * Entirely data-driven: limits come from IngredientLimit rows, mix rules from
 * CombinationRule rows, warnings from Warning/ProductWarning rows. This module
 * is the single source of truth — both the quote endpoint and checkout call
 * evaluateCart, so the client can never bypass a limit (spec §32.5/6).
 */
import { prisma } from "../lib/prisma.js";

export interface CartItemInput {
  productId: string;
  scoops: number;
}

export interface IngredientTotal {
  ingredientId: string;
  name: string;
  unit: string;
  amount: number;
  tracked: boolean;
}

export interface LimitStatus {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  amount: number;
  max: number;
  remaining: number;
  exceeded: boolean;
}

export interface WarningView {
  id: string;
  code: string;
  severity: "INFO" | "CAUTION" | "IMPORTANT" | "BLOCKING";
  title: string;
  body: string;
  requiresAcknowledgement: boolean;
}

export interface Violation {
  code: string;
  message: string;
  suggestions: string[];
}

export interface CartEvaluation {
  allowed: boolean;
  items: {
    productId: string;
    brand: string;
    name: string;
    flavor: string;
    scoops: number;
    unitPriceCents: number;
    lineTotalCents: number;
    gramsTarget: number;
    accentColor: string;
    imageKey: string;
  }[];
  totalCents: number;
  totalGrams: number;
  totals: IngredientTotal[];
  limits: LimitStatus[];
  warnings: WarningView[];
  violations: Violation[];
}

const productInclude = {
  brand: true,
  ingredients: { include: { ingredient: true } },
  warnings: { include: { warning: true } },
  tags: { include: { tag: true } },
} as const;

export async function evaluateCart(itemsInput: CartItemInput[]): Promise<CartEvaluation> {
  const violations: Violation[] = [];

  const products = await prisma.product.findMany({
    where: { id: { in: itemsInput.map((i) => i.productId) }, active: true },
    include: productInclude,
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const items: CartEvaluation["items"] = [];
  for (const input of itemsInput) {
    const product = byId.get(input.productId);
    if (!product) {
      violations.push({ code: "PRODUCT_UNAVAILABLE", message: "One of the selected products is no longer available.", suggestions: ["Remove it and choose another product."] });
      continue;
    }
    const scoops = Math.max(1, Math.floor(input.scoops));
    if (scoops > product.maxScoopsPerServing) {
      violations.push({
        code: "MAX_SCOOPS",
        message: `${product.name} is limited to ${product.maxScoopsPerServing} scoop${product.maxScoopsPerServing === 1 ? "" : "s"} per serving.`,
        suggestions: [`Choose ${product.maxScoopsPerServing} scoop${product.maxScoopsPerServing === 1 ? "" : "s"} instead.`],
      });
    }
    items.push({
      productId: product.id,
      brand: product.brand.name,
      name: product.name,
      flavor: product.flavor,
      scoops,
      unitPriceCents: product.pricePerScoopCents,
      lineTotalCents: product.pricePerScoopCents * scoops,
      gramsTarget: product.servingSizeGrams * scoops,
      accentColor: product.accentColor,
      imageKey: product.imageKey,
    });
  }

  // ── Ingredient totals (server-side, spec §32.6) ─────────────────────
  const totalsMap = new Map<string, IngredientTotal>();
  for (const input of itemsInput) {
    const product = byId.get(input.productId);
    if (!product) continue;
    for (const pi of product.ingredients) {
      const existing = totalsMap.get(pi.ingredientId);
      const amount = pi.amountPerScoop * Math.max(1, Math.floor(input.scoops));
      if (existing) existing.amount = round2(existing.amount + amount);
      else totalsMap.set(pi.ingredientId, {
        ingredientId: pi.ingredientId,
        name: pi.ingredient.name,
        unit: pi.ingredient.unit,
        amount: round2(amount),
        tracked: pi.ingredient.tracked,
      });
    }
  }
  const totals = [...totalsMap.values()].sort((a, b) => Number(b.tracked) - Number(a.tracked) || a.name.localeCompare(b.name));

  // ── Ingredient limits ───────────────────────────────────────────────
  const limitRows = await prisma.ingredientLimit.findMany({ where: { active: true }, include: { ingredient: true } });
  const limits: LimitStatus[] = [];
  for (const limit of limitRows) {
    const total = totalsMap.get(limit.ingredientId);
    const amount = total?.amount ?? 0;
    const exceeded = amount > limit.maxPerTransaction;
    // Only surface limits relevant to this cart (present, or exceeded)
    if (amount > 0) {
      limits.push({
        ingredientId: limit.ingredientId,
        ingredientName: limit.ingredient.name,
        unit: limit.ingredient.unit,
        amount,
        max: limit.maxPerTransaction,
        remaining: round2(Math.max(0, limit.maxPerTransaction - amount)),
        exceeded,
      });
    }
    if (exceeded) {
      violations.push({
        code: `LIMIT_${limit.ingredient.name.toUpperCase().replace(/[^A-Z]+/g, "_")}`,
        message: `This combination exceeds the maximum ${limit.ingredient.name.toLowerCase()} amount allowed for a single purchase (${limit.maxPerTransaction} ${limit.ingredient.unit}).`,
        suggestions: buildSuggestions(itemsInput, byId, limit.ingredientId, limit.maxPerTransaction),
      });
    }
  }

  // ── Combination rules (typed JSON configs — plug-in evaluators) ─────
  const rules = await prisma.combinationRule.findMany({ where: { active: true } });
  for (const rule of rules) {
    const cfg = rule.config as Record<string, unknown>;
    if (rule.type === "MAX_PRODUCTS_PER_MIX") {
      const max = Number(cfg.max ?? 2);
      if (itemsInput.length > max) {
        violations.push({
          code: "MAX_PRODUCTS_PER_MIX",
          message: `You can mix at most ${max} products in one serving.`,
          suggestions: ["Remove a product to continue."],
        });
      }
    } else if (rule.type === "INCOMPATIBLE_TAGS" && itemsInput.length > 1) {
      const tagSlugs = (cfg.tagSlugs as string[]) ?? [];
      const flagged = products.filter((p) => itemsInput.some((i) => i.productId === p.id) && p.tags.some((t) => tagSlugs.includes(t.tag.slug)));
      if (flagged.length > 0) {
        violations.push({
          code: "INCOMPATIBLE_COMBINATION",
          message: String(cfg.message ?? "These products cannot be mixed."),
          suggestions: flagged.map((p) => `Remove ${p.name} to continue.`),
        });
      }
    }
  }

  // ── Merged, de-duplicated warnings ──────────────────────────────────
  const warningMap = new Map<string, WarningView>();
  for (const input of itemsInput) {
    const product = byId.get(input.productId);
    if (!product) continue;
    for (const pw of product.warnings) {
      if (!pw.warning.active) continue;
      warningMap.set(pw.warning.id, {
        id: pw.warning.id,
        code: pw.warning.code,
        severity: pw.warning.severity,
        title: pw.warning.title,
        body: pw.warning.body,
        requiresAcknowledgement: pw.warning.requiresAcknowledgement,
      });
    }
  }
  const severityRank = { BLOCKING: 0, IMPORTANT: 1, CAUTION: 2, INFO: 3 } as const;
  const warnings = [...warningMap.values()].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  // A BLOCKING warning prevents the transaction entirely (spec §9)
  for (const w of warnings) {
    if (w.severity === "BLOCKING") {
      violations.push({ code: `BLOCKED_${w.code}`, message: w.body, suggestions: ["Please choose another product."] });
    }
  }

  return {
    allowed: violations.length === 0 && items.length > 0,
    items,
    totalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
    totalGrams: round2(items.reduce((sum, i) => sum + i.gramsTarget, 0)),
    totals,
    limits,
    warnings,
    violations,
  };
}

/** Suggest concrete valid alternatives ("You could choose 1 scoop instead."). */
function buildSuggestions(
  itemsInput: CartItemInput[],
  byId: Map<string, { name: string; ingredients: { ingredientId: string; amountPerScoop: number }[] }>,
  ingredientId: string,
  max: number,
): string[] {
  const suggestions: string[] = [];
  const amountFor = (items: CartItemInput[]) =>
    items.reduce((sum, item) => {
      const p = byId.get(item.productId);
      const pi = p?.ingredients.find((x) => x.ingredientId === ingredientId);
      return sum + (pi ? pi.amountPerScoop * item.scoops : 0);
    }, 0);

  // Try reducing scoops on each multi-scoop item
  for (const item of itemsInput) {
    if (item.scoops > 1) {
      const reduced = itemsInput.map((i) => (i === item ? { ...i, scoops: i.scoops - 1 } : i));
      if (amountFor(reduced) <= max) {
        suggestions.push(`You could choose ${item.scoops - 1} scoop${item.scoops - 1 === 1 ? "" : "s"} of ${byId.get(item.productId)?.name ?? "this product"} instead.`);
      }
    }
  }
  // Try removing each item
  if (itemsInput.length > 1) {
    for (const item of itemsInput) {
      const without = itemsInput.filter((i) => i !== item);
      if (amountFor(without) <= max) {
        suggestions.push(`Remove ${byId.get(item.productId)?.name ?? "a product"} to continue.`);
      }
    }
  }
  if (suggestions.length === 0) suggestions.push("Choose a product with a lower amount of this ingredient.");
  return suggestions.slice(0, 3);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
