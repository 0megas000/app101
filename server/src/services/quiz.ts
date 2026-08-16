/**
 * "Find My Pre" — transparent rule-based scoring engine (spec §19).
 * Every recommendation returns human-readable reasons, not a black box.
 */
import { prisma } from "../lib/prisma.js";

export interface QuizAnswers {
  energy: "LOW" | "MEDIUM" | "HIGH";
  caffeine: "YES" | "NO";
  tingle: "YES" | "NO" | "NOT_SURE";
  goal: "ENERGY" | "PUMP" | "FOCUS" | "PERFORMANCE";
  experience: "NEW" | "SOME" | "EXPERIENCED";
}

export async function recommend(answers: QuizAnswers) {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { brand: true, tags: { include: { tag: true } } },
  });

  const scored = products.map((p) => {
    let score = 0;
    const reasons: string[] = [];

    // Caffeine preference is a hard-ish gate
    if (answers.caffeine === "NO") {
      if (!p.isStimulant) { score += 40; reasons.push("Caffeine-free, as requested"); }
      else score -= 100;
    } else {
      if (p.isStimulant) score += 10;
      const desired = answers.energy === "HIGH" ? [250, 350] : answers.energy === "MEDIUM" ? [120, 220] : [50, 120];
      if (p.caffeineMgPerScoop >= desired[0]! && p.caffeineMgPerScoop <= desired[1]!) {
        score += 30;
        reasons.push(`${p.caffeineMgPerScoop} mg caffeine matches your ${answers.energy.toLowerCase()} energy preference`);
      } else if (Math.abs(p.caffeineMgPerScoop - (desired[0]! + desired[1]!) / 2) <= 75) {
        score += 12;
      }
    }

    // Tingle preference
    if (answers.tingle === "NO" && p.tingleRating === 0) { score += 20; reasons.push("No beta-alanine tingling"); }
    if (answers.tingle === "NO" && p.tingleRating >= 3) score -= 40;
    if (answers.tingle === "YES" && p.tingleRating >= 3) { score += 20; reasons.push("Delivers the tingle you asked for"); }

    // Goal
    if (answers.goal === "PUMP" && p.pumpRating >= 4) { score += 25; reasons.push("Strong pump ingredients"); }
    if (answers.goal === "FOCUS" && p.focusRating >= 4) { score += 25; reasons.push("Full focus stack"); }
    if (answers.goal === "ENERGY" && p.energyRating >= 4) { score += 20; reasons.push("High energy rating"); }
    if (answers.goal === "PERFORMANCE" && p.tags.some((t) => ["performance"].includes(t.tag.slug))) {
      score += 25; reasons.push("Performance-focused formula");
    }

    // Experience level
    if (answers.experience === "NEW") {
      if (p.strength === "BEGINNER") { score += 25; reasons.push("Beginner friendly"); }
      if (p.strength === "ADVANCED") score -= 35;
    } else if (answers.experience === "EXPERIENCED" && p.strength === "ADVANCED") {
      score += 12; reasons.push("Built for experienced users");
    }

    return {
      productId: p.id,
      brand: p.brand.name,
      name: p.name,
      flavor: p.flavor,
      accentColor: p.accentColor,
      imageKey: p.imageKey,
      caffeineMgPerScoop: p.caffeineMgPerScoop,
      score,
      reasons: reasons.slice(0, 3),
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
