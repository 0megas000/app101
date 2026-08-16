/**
 * Demo seed: fleet, ingredient knowledge base, 10 fictional products,
 * warnings, safety limits, promotions, education topics, admin users,
 * and ~30 days of simulated sales + interaction history.
 *
 * All brands and products are fictional (spec §29).
 */
import "../src/lib/env.js"; // must be first — populates DATABASE_URL before Prisma initialises
import { PrismaClient, UserRole, StrengthLevel, IngredientCategory, WarningSeverity, TransactionStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

const prisma = new PrismaClient();

export function hashPin(pin: string): string {
  return createHash("sha256").update(`pwx-pin:${pin}`).digest("hex");
}

async function main() {
  console.log("Seeding…");

  // Wipe in dependency order (idempotent re-seed)
  await prisma.$transaction([
    prisma.analyticsEvent.deleteMany(),
    prisma.dispensingEvent.deleteMany(),
    prisma.transactionItem.deleteMany(),
    prisma.saleTransaction.deleteMany(),
    prisma.inventoryTransaction.deleteMany(),
    prisma.inventoryBin.deleteMany(),
    prisma.machineError.deleteMany(),
    prisma.maintenanceEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.productWarning.deleteMany(),
    prisma.productTag.deleteMany(),
    prisma.productIngredient.deleteMany(),
    prisma.ingredientLimit.deleteMany(),
    prisma.combinationRule.deleteMany(),
    prisma.warning.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.product.deleteMany(),
    prisma.brand.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.educationTopic.deleteMany(),
    prisma.user.deleteMany(),
    prisma.machine.deleteMany(),
    prisma.location.deleteMany(),
    prisma.gym.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.systemSetting.deleteMany(),
  ]);

  // ── Fleet ──────────────────────────────────────────────────────────
  const org = await prisma.organization.create({ data: { name: "PulseFuel Systems" } });
  const gymA = await prisma.gym.create({ data: { name: "Ironworks Fitness", organizationId: org.id } });
  const gymB = await prisma.gym.create({ data: { name: "Northside Athletic Club", organizationId: org.id } });
  const locA1 = await prisma.location.create({ data: { name: "Main floor — free weights", gymId: gymA.id } });
  const locA2 = await prisma.location.create({ data: { name: "Cardio mezzanine", gymId: gymA.id } });
  const locB1 = await prisma.location.create({ data: { name: "Front lobby", gymId: gymB.id } });

  const machine1 = await prisma.machine.create({
    data: { serial: "PWX-001", name: "Ironworks — Machine 001", locationId: locA1.id, lastHeartbeatAt: new Date(), lastMaintenanceAt: daysAgo(6) },
  });
  await prisma.machine.create({ data: { serial: "PWX-002", name: "Ironworks — Machine 002", locationId: locA2.id, status: "OFFLINE" } });
  await prisma.machine.create({ data: { serial: "PWX-003", name: "Northside — Machine 003", locationId: locB1.id, lastHeartbeatAt: new Date() } });

  // ── Users (prototype PIN auth; see docs/API.md for credentials) ────
  await prisma.user.createMany({
    data: [
      { name: "Sam Rivera", email: "sam@pulsefuel.example", role: UserRole.SUPER_ADMIN, pinHash: hashPin("1234"), organizationId: org.id },
      { name: "Alex Chen", email: "alex@pulsefuel.example", role: UserRole.BUSINESS_ADMIN, pinHash: hashPin("2345"), organizationId: org.id },
      { name: "Jordan Blake", email: "jordan@ironworks.example", role: UserRole.GYM_MANAGER, pinHash: hashPin("3456"), organizationId: org.id, gymId: gymA.id },
      { name: "Riley Novak", email: "riley@pulsefuel.example", role: UserRole.TECHNICIAN, pinHash: hashPin("4567"), organizationId: org.id },
    ],
  });

  // ── Ingredient knowledge base ──────────────────────────────────────
  const I = async (
    name: string, category: IngredientCategory, unit: string, tracked: boolean,
    plain: string, sensation: string, technical: string, doseMin: number, doseMax: number, warningInfo?: string,
  ) =>
    prisma.ingredient.create({
      data: { name, category, unit, tracked, plainExplanation: plain, sensation, technicalExplanation: technical, typicalDoseMin: doseMin, typicalDoseMax: doseMax, warningInfo },
    });

  const caffeine = await I("Caffeine", "STIMULANT", "mg", true,
    "Caffeine is a stimulant that may help you feel more awake and energized during your workout.",
    "Increased alertness and energy. Too much can cause jitters, a racing heart, or trouble sleeping.",
    "Caffeine is an adenosine receptor antagonist. Common pre-workout doses range from 100–300 mg. Individual tolerance varies widely; total daily intake from all sources should be considered.",
    75, 300, "Limit total daily caffeine from all sources. Not recommended for people sensitive to stimulants.");
  const betaAlanine = await I("Beta-Alanine", "PERFORMANCE", "g", true,
    "Beta-alanine may help support high-intensity exercise performance.",
    "Some people experience a harmless tingling or prickling sensation called paresthesia, usually on the face, neck, or hands.",
    "Beta-alanine raises muscle carnosine, which buffers acid during high-intensity efforts. The tingling (paresthesia) is temporary and harmless. Typical doses: 1.6–6.4 g/day.",
    1.6, 6.4, "The tingling sensation is harmless and passes within about an hour.");
  const citrulline = await I("L-Citrulline", "PUMP", "g", false,
    "L-citrulline may help support blood flow, which many people describe as a fuller “pump” feeling while training.",
    "A fuller, tighter feeling in working muscles. No tingling.",
    "L-citrulline is converted to arginine, supporting nitric-oxide production. Common doses: 3–10 g. Citrulline malate at 2:1 provides roughly two-thirds citrulline by weight.",
    3, 10);
  const creatine = await I("Creatine Monohydrate", "PERFORMANCE", "g", false,
    "Creatine is one of the most studied supplement ingredients and may help support strength and power over time.",
    "No immediate sensation — its effects build with consistent daily use.",
    "Creatine increases phosphocreatine stores used for rapid ATP regeneration. 3–5 g daily is the common maintenance dose; timing matters less than consistency.",
    3, 5);
  const tyrosine = await I("L-Tyrosine", "FOCUS", "g", false,
    "L-tyrosine may help support focus, especially when you are tired or stressed.",
    "Most people feel nothing distinct — it works quietly in the background.",
    "Tyrosine is a precursor to dopamine and norepinephrine. Doses of 0.5–2 g pre-exercise are common in the research literature.",
    0.5, 2);
  const alphaGpc = await I("Alpha-GPC", "FOCUS", "mg", false,
    "Alpha-GPC is a choline source that may help support focus and mind-muscle connection.",
    "Subtle — some people report clearer focus.",
    "Alpha-glycerophosphocholine crosses the blood–brain barrier and supports acetylcholine synthesis. Common doses: 300–600 mg.",
    300, 600);
  const theanine = await I("L-Theanine", "FOCUS", "mg", false,
    "L-theanine may help smooth out the edgy feeling some people get from caffeine.",
    "A calmer, smoother energy when paired with caffeine.",
    "Theanine is an amino acid found in tea. It is commonly paired with caffeine at ratios near 1:1 to 2:1 (theanine:caffeine) to reduce jitteriness.",
    100, 400);
  const betaine = await I("Betaine Anhydrous", "PERFORMANCE", "g", false,
    "Betaine may help support power output and training volume.",
    "No noticeable sensation.",
    "Betaine (trimethylglycine) acts as an osmolyte and methyl donor. Common doses: 1.25–2.5 g.",
    1.25, 2.5);
  const taurine = await I("Taurine", "AMINO_ACID", "g", false,
    "Taurine is an amino acid that may help support hydration and endurance.",
    "No noticeable sensation.",
    "Taurine acts as an osmolyte and modulates calcium handling in muscle. Common doses: 1–3 g.",
    1, 3);
  const glycerol = await I("Glycerol", "PUMP", "g", false,
    "Glycerol helps your muscles hold water, which may support a fuller pump and hydration.",
    "A fuller feeling in the muscles, especially with adequate water intake.",
    "Glycerol is a hyperhydration agent. Drink plenty of water with glycerol-containing products. Common doses: 1–5 g of yielded glycerol.",
    1, 5);
  const yohimbine = await I("Yohimbine", "STIMULANT", "mg", true,
    "Yohimbine is a strong stimulant. It is not recommended for people sensitive to stimulants.",
    "Noticeably elevated heart rate and energy. Some people experience anxiety or nausea.",
    "Yohimbine is an alpha-2 adrenergic antagonist. Effects are strongly dose-dependent and it interacts with many conditions and medications. Doses above a few milligrams substantially increase side-effect risk.",
    0.5, 2.5, "Strong stimulant. Do not combine with other stimulant sources. Not recommended for stimulant-sensitive individuals.");
  const sodium = await I("Sodium", "ELECTROLYTE", "mg", false,
    "Sodium is an electrolyte lost in sweat. It helps you stay hydrated during hard sessions.",
    "No sensation — may make the drink taste slightly salty.",
    "Sodium supports plasma volume and fluid balance. Pre-exercise doses of 300–1000 mg are common for heavy sweaters.",
    300, 1000);
  const potassium = await I("Potassium", "ELECTROLYTE", "mg", false,
    "Potassium is an electrolyte that works alongside sodium to support hydration.",
    "No sensation.",
    "Potassium supports fluid balance and muscle contraction. Typical supplemental doses are 99–300 mg.",
    99, 300);
  const huperzine = await I("Huperzine A", "FOCUS", "mg", true,
    "Huperzine A may help support focus. It is a strong ingredient used in small amounts.",
    "Subtle focus effect; some people notice vivid dreams if taken late.",
    "Huperzine A is an acetylcholinesterase inhibitor, typically dosed at 0.05–0.2 mg. Because it has a long half-life, daily cycling is often suggested.",
    0.05, 0.2, "Potent in small doses; avoid combining multiple huperzine-containing products.");

  // ── Warnings ───────────────────────────────────────────────────────
  const W = (code: string, severity: WarningSeverity, title: string, body: string, requiresAcknowledgement = false) =>
    prisma.warning.create({ data: { code, severity, title, body, requiresAcknowledgement } });

  const wCaffeine = await W("CONTAINS_CAFFEINE", "CAUTION", "Contains caffeine",
    "This product contains caffeine. Limit your total daily caffeine intake from all sources, including coffee and energy drinks.", true);
  const wHighCaffeine = await W("HIGH_CAFFEINE", "IMPORTANT", "High caffeine content",
    "This product contains a high amount of caffeine per serving. Do not combine with other caffeine or stimulant sources today.", true);
  const wMinors = await W("NOT_FOR_MINORS", "IMPORTANT", "Not for minors",
    "Not recommended for anyone under 18 years of age.");
  const wPregnancy = await W("PREGNANCY", "IMPORTANT", "Pregnancy & nursing",
    "Not recommended during pregnancy or while nursing. Consult a qualified healthcare professional if appropriate.");
  const wTingle = await W("TINGLE", "INFO", "Tingling is normal",
    "This product contains beta-alanine, which can cause a harmless tingling sensation (paresthesia) that passes within about an hour.");
  const wYohimbine = await W("YOHIMBINE", "IMPORTANT", "Contains yohimbine",
    "Contains yohimbine, a strong stimulant. Not recommended for stimulant-sensitive individuals. Do not combine with other stimulant products.", true);
  const wDaily = await W("DAILY_LIMIT", "CAUTION", "Follow serving directions",
    "Do not exceed the recommended daily intake printed on the manufacturer label.");
  const wAllergen = await W("ALLERGEN_FACILITY", "INFO", "Allergen information",
    "Produced in a facility that also processes milk, soy, and tree nuts.");
  await W("RECALLED_LOT", "BLOCKING", "Product unavailable",
    "This product is temporarily unavailable due to a quality hold. Please choose another product.");

  // ── Safety limits & combination rules ──────────────────────────────
  await prisma.ingredientLimit.createMany({
    data: [
      { ingredientId: caffeine.id, maxPerTransaction: 300, note: "Aligned with common single-dose guidance; review per jurisdiction." },
      { ingredientId: betaAlanine.id, maxPerTransaction: 6.4, note: "Upper end of studied single-day dosing." },
      { ingredientId: yohimbine.id, maxPerTransaction: 2.5, note: "Conservative cap; strong stimulant." },
      { ingredientId: huperzine.id, maxPerTransaction: 0.2, note: "Long half-life; conservative cap." },
    ],
  });
  await prisma.combinationRule.createMany({
    data: [
      { type: "MAX_PRODUCTS_PER_MIX", name: "Maximum products per mix", config: { max: 2 } },
      { type: "INCOMPATIBLE_TAGS", name: "No double-stim extreme mixes", config: { tagSlugs: ["extreme-stim"], message: "Extreme-stimulant products cannot be mixed with other products." } },
    ],
  });

  // ── Tags ───────────────────────────────────────────────────────────
  const tagDefs: [string, string][] = [
    ["stim", "Stim Pre"], ["non-stim", "Non-Stim"], ["high-energy", "High Energy"],
    ["moderate-energy", "Moderate Energy"], ["low-caffeine", "Low Caffeine"],
    ["pump", "Pump Focused"], ["tingle", "Tingle / Beta-Alanine"], ["no-tingle", "No Tingle"],
    ["beginner", "Beginner Friendly"], ["advanced", "Advanced"], ["popular", "Popular"],
    ["staff-pick", "Staff Picks"], ["focus", "Focus"], ["performance", "Performance"],
    ["electrolytes", "Electrolytes"], ["extreme-stim", "Extreme Stim"],
  ];
  const tags: Record<string, string> = {};
  for (const [slug, label] of tagDefs) {
    const t = await prisma.tag.create({ data: { slug, label } });
    tags[slug] = t.id;
  }

  // ── Brands & products ──────────────────────────────────────────────
  const brandVoltage = await prisma.brand.create({ data: { name: "Voltage Labs", organizationId: org.id } });
  const brandApex = await prisma.brand.create({ data: { name: "Apex Form", organizationId: org.id } });
  const brandIron = await prisma.brand.create({ data: { name: "Iron Ritual", organizationId: org.id } });
  const brandMind = await prisma.brand.create({ data: { name: "Mindforge", organizationId: org.id } });
  const brandNorth = await prisma.brand.create({ data: { name: "Northlift", organizationId: org.id } });

  type Ing = { id: string; amount: number; major?: boolean };
  const P = async (opts: {
    brandId: string; name: string; flavor: string; description: string; imageKey: string; accent: string;
    price: number; grams: number; caffeine: number; stim: boolean; energy: number; pump: number; tingle: number; focus?: number;
    strength: StrengthLevel; featured?: boolean; staffPick?: boolean; maxScoops?: number;
    vegan?: boolean; sugarFree?: boolean; dyeFree?: boolean; dietaryVerified?: boolean;
    ingredients: Ing[]; warningIds: string[]; tagSlugs: string[];
    facts: { label: string; amount: number; unit: string }[];
  }) => {
    const p = await prisma.product.create({
      data: {
        organizationId: org.id, brandId: opts.brandId, name: opts.name, flavor: opts.flavor,
        description: opts.description, imageKey: opts.imageKey, accentColor: opts.accent,
        pricePerScoopCents: opts.price, servingSizeGrams: opts.grams,
        maxScoopsPerServing: opts.maxScoops ?? 2,
        caffeineMgPerScoop: opts.caffeine, isStimulant: opts.stim,
        energyRating: opts.energy, pumpRating: opts.pump, tingleRating: opts.tingle, focusRating: opts.focus ?? 0,
        strength: opts.strength, featured: opts.featured ?? false, staffPick: opts.staffPick ?? false,
        vegan: opts.vegan ?? false, sugarFree: opts.sugarFree ?? true, dyeFree: opts.dyeFree ?? false,
        dietaryVerified: opts.dietaryVerified ?? true,
        supplementFacts: opts.facts,
        ingredients: { create: opts.ingredients.map((i) => ({ ingredientId: i.id, amountPerScoop: i.amount, major: i.major ?? true })) },
        warnings: { create: opts.warningIds.map((warningId) => ({ warningId })) },
        tags: { create: opts.tagSlugs.map((s) => ({ tagId: tags[s]! })) },
      },
    });
    return p;
  };

  const overdrive = await P({
    brandId: brandVoltage.id, name: "Overdrive", flavor: "Blue Razz", imageKey: "bolt", accent: "#3b82f6",
    description: "A full-throttle high-stimulant formula for experienced lifters who want maximum energy and a strong tingle. Not a starting point — a destination.",
    price: 349, grams: 14, caffeine: 300, stim: true, energy: 5, pump: 3, tingle: 4, focus: 3,
    strength: "ADVANCED", featured: true, maxScoops: 1,
    ingredients: [
      { id: caffeine.id, amount: 300 }, { id: betaAlanine.id, amount: 3.2 }, { id: citrulline.id, amount: 6 },
      { id: tyrosine.id, amount: 1 }, { id: taurine.id, amount: 1, major: false },
    ],
    warningIds: [wCaffeine.id, wHighCaffeine.id, wMinors.id, wPregnancy.id, wTingle.id, wDaily.id],
    tagSlugs: ["stim", "high-energy", "tingle", "advanced", "popular"],
    facts: [
      { label: "Caffeine Anhydrous", amount: 300, unit: "mg" }, { label: "Beta-Alanine", amount: 3.2, unit: "g" },
      { label: "L-Citrulline", amount: 6, unit: "g" }, { label: "L-Tyrosine", amount: 1, unit: "g" },
      { label: "Taurine", amount: 1, unit: "g" }, { label: "Sodium", amount: 150, unit: "mg" },
    ],
  });

  const surge = await P({
    brandId: brandVoltage.id, name: "Surge", flavor: "Fruit Punch", imageKey: "wave", accent: "#ef4444",
    description: "Balanced everyday energy with a moderate caffeine dose and a light tingle. The crowd favorite for good reason.",
    price: 299, grams: 12, caffeine: 175, stim: true, energy: 3, pump: 3, tingle: 2, focus: 2,
    strength: "INTERMEDIATE", featured: true, staffPick: true,
    ingredients: [
      { id: caffeine.id, amount: 175 }, { id: betaAlanine.id, amount: 1.6 }, { id: citrulline.id, amount: 4 },
      { id: betaine.id, amount: 1.25, major: false },
    ],
    warningIds: [wCaffeine.id, wMinors.id, wPregnancy.id, wTingle.id, wDaily.id],
    tagSlugs: ["stim", "moderate-energy", "popular", "staff-pick"],
    facts: [
      { label: "Caffeine Anhydrous", amount: 175, unit: "mg" }, { label: "Beta-Alanine", amount: 1.6, unit: "g" },
      { label: "L-Citrulline", amount: 4, unit: "g" }, { label: "Betaine Anhydrous", amount: 1.25, unit: "g" },
    ],
  });

  const firstRep = await P({
    brandId: brandApex.id, name: "First Rep", flavor: "Strawberry Lemonade", imageKey: "sprout", accent: "#f472b6",
    description: "Made for your first pre-workout. Gentle energy, no tingle, no crash — just enough lift to make training feel easier.",
    price: 249, grams: 10, caffeine: 100, stim: true, energy: 2, pump: 2, tingle: 0,
    strength: "BEGINNER", featured: true, vegan: true, dyeFree: true,
    ingredients: [
      { id: caffeine.id, amount: 100 }, { id: citrulline.id, amount: 3 }, { id: theanine.id, amount: 100 },
    ],
    warningIds: [wCaffeine.id, wMinors.id, wPregnancy.id, wDaily.id],
    tagSlugs: ["stim", "low-caffeine", "no-tingle", "beginner", "popular"],
    facts: [
      { label: "Caffeine (natural)", amount: 100, unit: "mg" }, { label: "L-Citrulline", amount: 3, unit: "g" },
      { label: "L-Theanine", amount: 100, unit: "mg" },
    ],
  });

  const bloodline = await P({
    brandId: brandApex.id, name: "Bloodline Pump", flavor: "Watermelon", imageKey: "drop", accent: "#22c55e",
    description: "A caffeine-free pump formula built around a big citrulline dose and glycerol. Train late, sleep fine, still get the pump.",
    price: 329, grams: 16, caffeine: 0, stim: false, energy: 1, pump: 5, tingle: 0,
    strength: "INTERMEDIATE", staffPick: true, vegan: true,
    ingredients: [
      { id: citrulline.id, amount: 8 }, { id: glycerol.id, amount: 3 }, { id: betaine.id, amount: 2.5 },
      { id: potassium.id, amount: 200, major: false },
    ],
    warningIds: [wDaily.id],
    tagSlugs: ["non-stim", "pump", "no-tingle", "staff-pick"],
    facts: [
      { label: "L-Citrulline", amount: 8, unit: "g" }, { label: "Glycerol", amount: 3, unit: "g" },
      { label: "Betaine Anhydrous", amount: 2.5, unit: "g" }, { label: "Potassium", amount: 200, unit: "mg" },
    ],
  });

  const staticP = await P({
    brandId: brandIron.id, name: "Static", flavor: "Sour Gummy", imageKey: "zap", accent: "#eab308",
    description: "For people who love the tingle. A heavy beta-alanine dose with solid caffeine — you will absolutely feel this one.",
    price: 319, grams: 13, caffeine: 200, stim: true, energy: 4, pump: 2, tingle: 5,
    strength: "ADVANCED",
    ingredients: [
      { id: caffeine.id, amount: 200 }, { id: betaAlanine.id, amount: 4.5 }, { id: tyrosine.id, amount: 1 },
    ],
    warningIds: [wCaffeine.id, wMinors.id, wPregnancy.id, wTingle.id, wDaily.id],
    tagSlugs: ["stim", "high-energy", "tingle", "advanced"],
    facts: [
      { label: "Caffeine Anhydrous", amount: 200, unit: "mg" }, { label: "Beta-Alanine", amount: 4.5, unit: "g" },
      { label: "L-Tyrosine", amount: 1, unit: "g" },
    ],
  });

  const smooth = await P({
    brandId: brandIron.id, name: "Smooth Operator", flavor: "Peach Mango", imageKey: "sun", accent: "#fb923c",
    description: "Clean, steady energy with zero tingle. Caffeine paired with theanine for a smooth ride from warm-up to last set.",
    price: 299, grams: 11, caffeine: 150, stim: true, energy: 3, pump: 3, tingle: 0, focus: 2,
    strength: "INTERMEDIATE", dyeFree: true,
    ingredients: [
      { id: caffeine.id, amount: 150 }, { id: theanine.id, amount: 200 }, { id: citrulline.id, amount: 4 },
    ],
    warningIds: [wCaffeine.id, wMinors.id, wPregnancy.id, wDaily.id],
    tagSlugs: ["stim", "moderate-energy", "no-tingle"],
    facts: [
      { label: "Caffeine Anhydrous", amount: 150, unit: "mg" }, { label: "L-Theanine", amount: 200, unit: "mg" },
      { label: "L-Citrulline", amount: 4, unit: "g" },
    ],
  });

  const deepFocus = await P({
    brandId: brandMind.id, name: "Deep Focus", flavor: "Yuzu Citrus", imageKey: "eye", accent: "#a855f7",
    description: "A nootropic-leaning formula: moderate caffeine plus a full focus stack for locked-in, mind-muscle sessions.",
    price: 339, grams: 12, caffeine: 125, stim: true, energy: 3, pump: 1, tingle: 0, focus: 5,
    strength: "INTERMEDIATE", staffPick: true,
    ingredients: [
      { id: caffeine.id, amount: 125 }, { id: alphaGpc.id, amount: 600 }, { id: tyrosine.id, amount: 2 },
      { id: theanine.id, amount: 200 }, { id: huperzine.id, amount: 0.1, major: false },
    ],
    warningIds: [wCaffeine.id, wMinors.id, wPregnancy.id, wDaily.id],
    tagSlugs: ["stim", "moderate-energy", "focus", "no-tingle", "staff-pick"],
    facts: [
      { label: "Caffeine Anhydrous", amount: 125, unit: "mg" }, { label: "Alpha-GPC", amount: 600, unit: "mg" },
      { label: "L-Tyrosine", amount: 2, unit: "g" }, { label: "L-Theanine", amount: 200, unit: "mg" },
      { label: "Huperzine A", amount: 0.1, unit: "mg" },
    ],
  });

  const easyStart = await P({
    brandId: brandNorth.id, name: "Easy Start", flavor: "Green Apple", imageKey: "leaf", accent: "#4ade80",
    description: "The lowest-caffeine option on the machine. A gentle nudge, not a shove — great for evening sessions or caffeine-light days.",
    price: 229, grams: 9, caffeine: 75, stim: true, energy: 1, pump: 1, tingle: 0,
    strength: "BEGINNER", vegan: true, dyeFree: true,
    ingredients: [
      { id: caffeine.id, amount: 75 }, { id: taurine.id, amount: 1 }, { id: sodium.id, amount: 300, major: false },
    ],
    warningIds: [wCaffeine.id, wMinors.id, wDaily.id],
    tagSlugs: ["stim", "low-caffeine", "no-tingle", "beginner"],
    facts: [
      { label: "Caffeine (green tea)", amount: 75, unit: "mg" }, { label: "Taurine", amount: 1, unit: "g" },
      { label: "Sodium", amount: 300, unit: "mg" },
    ],
  });

  const redline = await P({
    brandId: brandVoltage.id, name: "Redline X", flavor: "Cherry Ice", imageKey: "flame", accent: "#dc2626",
    description: "Our most aggressive formula: near-limit caffeine plus yohimbine. Experienced stimulant users only. Cannot be mixed with other products.",
    price: 399, grams: 15, caffeine: 275, stim: true, energy: 5, pump: 2, tingle: 3, focus: 3,
    strength: "ADVANCED", maxScoops: 1,
    ingredients: [
      { id: caffeine.id, amount: 275 }, { id: yohimbine.id, amount: 2 }, { id: betaAlanine.id, amount: 2.4 },
      { id: tyrosine.id, amount: 1.5, major: false },
    ],
    warningIds: [wCaffeine.id, wHighCaffeine.id, wYohimbine.id, wMinors.id, wPregnancy.id, wTingle.id, wDaily.id, wAllergen.id],
    tagSlugs: ["stim", "high-energy", "advanced", "extreme-stim", "tingle"],
    facts: [
      { label: "Caffeine Anhydrous", amount: 275, unit: "mg" }, { label: "Yohimbine HCl", amount: 2, unit: "mg" },
      { label: "Beta-Alanine", amount: 2.4, unit: "g" }, { label: "L-Tyrosine", amount: 1.5, unit: "g" },
    ],
  });

  const endure = await P({
    brandId: brandApex.id, name: "Endure", flavor: "Salted Lime", imageKey: "mountain", accent: "#06b6d4",
    description: "A stimulant-free performance base: creatine, betaine, and a real electrolyte dose. Stack it with anything or run it solo.",
    price: 279, grams: 12, caffeine: 0, stim: false, energy: 0, pump: 2, tingle: 0,
    strength: "BEGINNER", vegan: true, dyeFree: true,
    ingredients: [
      { id: creatine.id, amount: 5 }, { id: betaine.id, amount: 2.5 }, { id: sodium.id, amount: 500 },
      { id: potassium.id, amount: 200, major: false }, { id: taurine.id, amount: 1, major: false },
    ],
    warningIds: [wDaily.id],
    tagSlugs: ["non-stim", "performance", "electrolytes", "no-tingle", "beginner"],
    facts: [
      { label: "Creatine Monohydrate", amount: 5, unit: "g" }, { label: "Betaine Anhydrous", amount: 2.5, unit: "g" },
      { label: "Sodium", amount: 500, unit: "mg" }, { label: "Potassium", amount: 200, unit: "mg" },
      { label: "Taurine", amount: 1, unit: "g" },
    ],
  });

  const products = [overdrive, surge, firstRep, bloodline, staticP, smooth, deepFocus, easyStart, redline, endure];

  // ── Bins on machine PWX-001 (weight-tracked inventory) ─────────────
  const fills = [0.82, 0.67, 0.74, 0.19, 0.55, 0.61, 0.88, 0.43, 0.35, 0.07];
  for (let i = 0; i < products.length; i++) {
    const prod = products[i]!;
    const capacity = 10000;
    const current = Math.round(capacity * fills[i]!);
    const bin = await prisma.inventoryBin.create({
      data: {
        machineId: machine1.id, binNumber: i + 1, productId: prod.id,
        capacityGrams: capacity, currentGrams: current, lowThresholdGrams: 2000,
        lotNumber: `LOT-2026-${String(140 + i * 7)}`,
        expiresAt: new Date(Date.now() + (200 + i * 30) * 86400_000),
        lastRefillAt: daysAgo(3 + (i % 9)),
      },
    });
    await prisma.inventoryTransaction.create({
      data: { binId: bin.id, type: "REFILL", deltaGrams: current, note: "Initial fill" },
    });
  }

  // ── Settings ───────────────────────────────────────────────────────
  await prisma.systemSetting.createMany({
    data: [
      { key: "kiosk.idleTimeoutSeconds", value: 60 },
      { key: "kiosk.completeScreenSeconds", value: 12 },
      { key: "kiosk.attractRotationSeconds", value: 7 },
      { key: "safety.requireCaffeineAcknowledgement", value: true },
    ],
  });

  // ── Promotions / idle playlist ─────────────────────────────────────
  await prisma.promotion.createMany({
    data: [
      { kind: "MESSAGE", title: "Need Energy?", subtitle: "Find a stim pre-workout matched to your tolerance", accentColor: "#3b82f6", sortOrder: 1 },
      { kind: "MESSAGE", title: "Looking for a Pump?", subtitle: "Caffeine-free options that still hit hard", accentColor: "#22c55e", sortOrder: 2 },
      { kind: "PRODUCT_FEATURE", title: "Try Surge — Fruit Punch", subtitle: "Our most popular everyday pre-workout", productId: surge.id, accentColor: "#ef4444", sortOrder: 3 },
      { kind: "MESSAGE", title: "Want the Tingle?", subtitle: "Static packs 4.5 g of beta-alanine per scoop", accentColor: "#eab308", sortOrder: 4 },
      { kind: "PRODUCT_FEATURE", title: "New: Bloodline Pump", subtitle: "Zero caffeine. Maximum pump. Train late, sleep fine.", productId: bloodline.id, accentColor: "#22c55e", sortOrder: 5 },
      { kind: "MESSAGE", title: "First time trying pre-workout?", subtitle: "Tap start, then try FIND MY PRE — we'll match you in 20 seconds", accentColor: "#a855f7", sortOrder: 6 },
    ],
  });

  // ── Education topics ───────────────────────────────────────────────
  await prisma.educationTopic.createMany({
    data: [
      { slug: "what-is-preworkout", title: "What is pre-workout?", emoji: "⚡", sortOrder: 1, body: "Pre-workout is a powdered drink mix taken before training. Most formulas combine ingredients for energy (like caffeine), blood flow (like citrulline), and performance (like beta-alanine or creatine). You mix one scoop with water and drink it 15–30 minutes before exercising." },
      { slug: "what-does-caffeine-do", title: "What does caffeine do?", emoji: "☕", sortOrder: 2, body: "Caffeine is the main energy ingredient in most pre-workouts. It may help you feel more awake and ready to train. Doses in this machine range from 0 to 300 mg per serving — for comparison, a typical cup of coffee has about 95 mg. If you're new, start low." },
      { slug: "what-causes-the-tingle", title: "What causes the tingle?", emoji: "✨", sortOrder: 3, body: "That prickly feeling on your face and hands comes from beta-alanine. It's called paresthesia, it's harmless, and it fades within about an hour. Some people love it as a 'it's working' signal; others prefer to skip it. Use the NO TINGLE filter if it's not for you." },
      { slug: "what-is-a-pump", title: "What is a pump?", emoji: "💪", sortOrder: 4, body: "The 'pump' is the full, tight feeling in your muscles during training, caused by increased blood flow. Ingredients like L-citrulline and glycerol are included to support it. Pump formulas work with or without caffeine." },
      { slug: "stim-vs-nonstim", title: "Stim vs. non-stim?", emoji: "🌙", sortOrder: 5, body: "Stim pre-workouts contain caffeine or other stimulants — great for energy, but not ideal late at night or if you're sensitive. Non-stim formulas skip the stimulants entirely and focus on pump and performance, so you can train in the evening and still sleep." },
    ],
  });

  // ── 30 days of simulated history (sales + interaction funnel) ──────
  const rand = mulberry32(42);
  const popularity = [0.16, 0.2, 0.12, 0.1, 0.07, 0.08, 0.09, 0.06, 0.05, 0.07]; // matches products[]
  let txCount = 0;
  const analyticsBatch: { machineId: string; sessionId: string; type: string; payload?: object; createdAt: Date }[] = [];

  for (let day = 30; day >= 1; day--) {
    const date = daysAgo(day);
    const isWeekend = [0, 6].includes(date.getDay());
    const sessions = Math.floor((isWeekend ? 26 : 34) + rand() * 14);
    for (let s = 0; s < sessions; s++) {
      const hour = weightedHour(rand);
      const at = new Date(date); at.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
      const sessionId = randomUUID();
      const push = (type: string, payload?: object, offsetSec = 0) =>
        analyticsBatch.push({ machineId: machine1.id, sessionId, type, payload, createdAt: new Date(at.getTime() + offsetSec * 1000) });

      push("session_start");
      if (rand() < 0.5) push("filter_applied", { filters: pick(rand, [["stim"], ["non-stim"], ["pump"], ["no-tingle"], ["stim", "moderate-energy"], ["beginner"]]) }, 5);
      const viewedIdx = pickIndex(rand, popularity);
      const viewed = products[viewedIdx]!;
      push("product_viewed", { productId: viewed.id, name: viewed.name }, 12);
      if (rand() < 0.3) push("ingredient_info_opened", { ingredient: pick(rand, ["Caffeine", "Beta-Alanine", "L-Citrulline", "Creatine Monohydrate"]) }, 20);
      if (rand() < 0.18) {
        const otherIdx = (viewedIdx + 1 + Math.floor(rand() * 9)) % 10;
        push("products_compared", { productIds: [viewed.id, products[otherIdx]!.id] }, 26);
      }
      if (rand() < 0.62) {
        push("added_to_mix", { productId: viewed.id }, 34);
        if (rand() < 0.75) {
          push("checkout_started", {}, 48);
          if (rand() < 0.85) {
            // Completed purchase
            const scoops = viewed.maxScoopsPerServing > 1 && rand() < 0.35 ? 2 : 1;
            const mixSecond = rand() < 0.12 && viewed.caffeineMgPerScoop <= 175;
            const items = [{ product: viewed, scoops }];
            if (mixSecond) items.push({ product: endure, scoops: 1 });
            const totalCents = items.reduce((sum, it) => sum + it.product.pricePerScoopCents * it.scoops, 0);
            const totalCaffeine = items.reduce((sum, it) => sum + it.product.caffeineMgPerScoop * it.scoops, 0);
            push("warnings_acknowledged", {}, 55);
            push("payment_completed", { totalCents }, 62);
            const tx = await prisma.saleTransaction.create({
              data: {
                machineId: machine1.id, kioskSessionId: sessionId, status: TransactionStatus.COMPLETED,
                totalCents, totalCaffeineMg: totalCaffeine,
                ingredientTotals: [{ name: "Caffeine", amount: totalCaffeine, unit: "mg" }],
                acknowledgedWarningIds: [], paymentMethod: "SIMULATED_CARD",
                paymentRef: `SIM-${String(txCount + 1).padStart(6, "0")}`,
                createdAt: at, completedAt: new Date(at.getTime() + 90_000),
                items: { create: items.map((it) => ({ productId: it.product.id, scoops: it.scoops, unitPriceCents: it.product.pricePerScoopCents, gramsTarget: it.product.servingSizeGrams * it.scoops })) },
              },
            });
            for (const it of items) {
              await prisma.dispensingEvent.create({
                data: { transactionId: tx.id, productName: `${it.product.name} — ${it.product.flavor}`, status: "READY", gramsTarget: it.product.servingSizeGrams * it.scoops, gramsActual: round1(it.product.servingSizeGrams * it.scoops * (0.98 + rand() * 0.04)), startedAt: at, finishedAt: new Date(at.getTime() + 80_000), createdAt: at },
              });
            }
            txCount++;
          } else {
            push("payment_failed", { reason: "SIMULATED_DECLINE" }, 62);
          }
        } else {
          push("session_timeout", {}, 120);
        }
      }
    }
  }
  // Insert analytics in chunks
  for (let i = 0; i < analyticsBatch.length; i += 500) {
    await prisma.analyticsEvent.createMany({ data: analyticsBatch.slice(i, i + 500) });
  }

  // A couple of historical machine errors + maintenance
  await prisma.machineError.createMany({
    data: [
      { machineId: machine1.id, code: "DISPENSER_JAM", severity: "ERROR", message: "Auger stall detected on bin 4 during dispense", component: "dispenser", createdAt: daysAgo(9), resolvedAt: daysAgo(9) },
      { machineId: machine1.id, code: "SCALE_DRIFT", severity: "WARNING", message: "Load cell drift above 0.5 g — calibration recommended", component: "scale", createdAt: daysAgo(4), resolvedAt: daysAgo(3) },
    ],
  });
  await prisma.maintenanceEvent.createMany({
    data: [
      { machineId: machine1.id, kind: "CLEANING", note: "Full powder-pathway clean", performedBy: "Riley Novak", createdAt: daysAgo(6) },
      { machineId: machine1.id, kind: "CALIBRATION", note: "Scale recalibrated after drift warning", performedBy: "Riley Novak", createdAt: daysAgo(3) },
    ],
  });

  console.log(`Seeded: ${products.length} products, ${txCount} historical transactions, ${analyticsBatch.length} analytics events.`);
}

// ── helpers ──────────────────────────────────────────────────────────
function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); d.setHours(10, 0, 0, 0); return d;
}
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function weightedHour(rand: () => number): number {
  // Gym traffic: morning (6-9) and evening (16-20) peaks
  const r = rand();
  if (r < 0.35) return 6 + Math.floor(rand() * 4);
  if (r < 0.75) return 16 + Math.floor(rand() * 5);
  return 9 + Math.floor(rand() * 7);
}
function pick<T>(rand: () => number, arr: T[]): T { return arr[Math.floor(rand() * arr.length)]!; }
function pickIndex(rand: () => number, weights: number[]): number {
  const r = rand(); let acc = 0;
  for (let i = 0; i < weights.length; i++) { acc += weights[i]!; if (r < acc) return i; }
  return weights.length - 1;
}
function round1(n: number): number { return Math.round(n * 10) / 10; }

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
