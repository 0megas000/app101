/**
 * First-party analytics (spec §15, §16): sales + anonymous interaction
 * aggregations computed from the transaction tables and the event stream.
 */
import { prisma } from "../lib/prisma.js";

function startOfDay(d: Date): Date {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function daysAgo(n: number): Date {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}

export async function salesOverview() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = daysAgo(7);
  const monthStart = daysAgo(30);

  const completed = { status: "COMPLETED" as const };
  const [today, week, month, monthTx] = await Promise.all([
    prisma.saleTransaction.aggregate({ where: { ...completed, createdAt: { gte: todayStart } }, _sum: { totalCents: true }, _count: true }),
    prisma.saleTransaction.aggregate({ where: { ...completed, createdAt: { gte: weekStart } }, _sum: { totalCents: true }, _count: true }),
    prisma.saleTransaction.aggregate({ where: { ...completed, createdAt: { gte: monthStart } }, _sum: { totalCents: true }, _count: true, _avg: { totalCents: true } }),
    prisma.transactionItem.groupBy({
      by: ["productId"],
      where: { transaction: { ...completed, createdAt: { gte: monthStart } } },
      _sum: { scoops: true },
      _count: true,
    }),
  ]);

  const productIds = monthTx.map((g) => g.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } }, include: { brand: true } });
  const ranked = monthTx
    .map((g) => ({
      product: products.find((p) => p.id === g.productId),
      purchases: g._count,
      scoops: g._sum.scoops ?? 0,
    }))
    .filter((r) => r.product)
    .sort((a, b) => b.purchases - a.purchases);

  const bins = await prisma.inventoryBin.findMany({ include: { product: true }, orderBy: { binNumber: "asc" } });
  const lowest = [...bins].filter((b) => b.product).sort((a, b) => a.currentGrams / a.capacityGrams - b.currentGrams / b.capacityGrams)[0];

  return {
    todaySalesCents: today._sum.totalCents ?? 0,
    todayTransactions: today._count,
    weekSalesCents: week._sum.totalCents ?? 0,
    monthSalesCents: month._sum.totalCents ?? 0,
    monthTransactions: month._count,
    averageTransactionCents: Math.round(month._avg.totalCents ?? 0),
    mostPopular: ranked[0]?.product ? { name: ranked[0].product.name, brand: ranked[0].product.brand.name, purchases: ranked[0].purchases } : null,
    lowestInventory: lowest?.product
      ? { name: lowest.product.name, percent: Math.round((lowest.currentGrams / lowest.capacityGrams) * 100), binNumber: lowest.binNumber }
      : null,
  };
}

export async function salesSeries(days = 30) {
  const since = daysAgo(days);
  const txs = await prisma.saleTransaction.findMany({
    where: { status: "COMPLETED", createdAt: { gte: since } },
    select: { totalCents: true, createdAt: true },
  });
  const byDay = new Map<string, { revenueCents: number; count: number }>();
  const byHour = Array.from({ length: 24 }, () => ({ revenueCents: 0, count: 0 }));
  const byWeekday = Array.from({ length: 7 }, () => ({ revenueCents: 0, count: 0 }));
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(startOfDay(daysAgo(i)).toISOString().slice(0, 10), { revenueCents: 0, count: 0 });
  }
  for (const tx of txs) {
    const key = startOfDay(tx.createdAt).toISOString().slice(0, 10);
    const day = byDay.get(key);
    if (day) { day.revenueCents += tx.totalCents; day.count++; }
    const hour = byHour[tx.createdAt.getHours()]!;
    hour.revenueCents += tx.totalCents; hour.count++;
    const wd = byWeekday[tx.createdAt.getDay()]!;
    wd.revenueCents += tx.totalCents; wd.count++;
  }
  return {
    daily: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    hourly: byHour.map((v, hour) => ({ hour, ...v })),
    weekday: byWeekday.map((v, weekday) => ({ weekday, ...v })),
  };
}

export async function productPerformance(days = 30) {
  const since = daysAgo(days);
  const groups = await prisma.transactionItem.groupBy({
    by: ["productId", "scoops"],
    where: { transaction: { status: "COMPLETED", createdAt: { gte: since } } },
    _count: true,
    _sum: { unitPriceCents: true },
  });
  const products = await prisma.product.findMany({ include: { brand: true } });
  const map = new Map<string, { name: string; brand: string; flavor: string; purchases: number; revenueCents: number; oneScoop: number; twoScoop: number }>();
  for (const p of products) {
    map.set(p.id, { name: p.name, brand: p.brand.name, flavor: p.flavor, purchases: 0, revenueCents: 0, oneScoop: 0, twoScoop: 0 });
  }
  for (const g of groups) {
    const row = map.get(g.productId);
    if (!row) continue;
    row.purchases += g._count;
    row.revenueCents += (g._sum.unitPriceCents ?? 0) * g.scoops;
    if (g.scoops === 1) row.oneScoop += g._count;
    else row.twoScoop += g._count;
  }
  // Mixed-purchase count
  const mixed = await prisma.saleTransaction.count({
    where: { status: "COMPLETED", createdAt: { gte: since }, items: { some: {} } , AND: [{ items: { some: {} } }] },
  });
  const multiItem = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*)::bigint AS count FROM (
      SELECT "transactionId" FROM "TransactionItem" ti
      JOIN "SaleTransaction" st ON st.id = ti."transactionId"
      WHERE st.status = 'COMPLETED' AND st."createdAt" >= ${since}
      GROUP BY "transactionId" HAVING COUNT(*) > 1
    ) q`;
  return {
    products: [...map.values()].sort((a, b) => b.revenueCents - a.revenueCents),
    totalCompleted: mixed,
    mixedPurchases: Number(multiItem[0]?.count ?? 0),
  };
}

export async function interactionFunnel(days = 30) {
  const since = daysAgo(days);
  const groups = await prisma.analyticsEvent.groupBy({
    by: ["type"],
    where: { createdAt: { gte: since } },
    _count: true,
  });
  const count = (type: string) => groups.find((g) => g.type === type)?._count ?? 0;

  // Top viewed products & ingredients
  const viewEvents = await prisma.analyticsEvent.findMany({
    where: { type: "product_viewed", createdAt: { gte: since } },
    select: { payload: true },
  });
  const viewCounts = new Map<string, number>();
  for (const e of viewEvents) {
    const name = (e.payload as { name?: string } | null)?.name ?? "unknown";
    viewCounts.set(name, (viewCounts.get(name) ?? 0) + 1);
  }
  const ingredientEvents = await prisma.analyticsEvent.findMany({
    where: { type: "ingredient_info_opened", createdAt: { gte: since } },
    select: { payload: true },
  });
  const ingredientCounts = new Map<string, number>();
  for (const e of ingredientEvents) {
    const name = (e.payload as { ingredient?: string } | null)?.ingredient ?? "unknown";
    ingredientCounts.set(name, (ingredientCounts.get(name) ?? 0) + 1);
  }
  const filterEvents = await prisma.analyticsEvent.findMany({
    where: { type: "filter_applied", createdAt: { gte: since } },
    select: { payload: true },
  });
  const filterCounts = new Map<string, number>();
  for (const e of filterEvents) {
    const filters = (e.payload as { filters?: string[] } | null)?.filters ?? [];
    const key = filters.join(" + ") || "unknown";
    filterCounts.set(key, (filterCounts.get(key) ?? 0) + 1);
  }
  const top = (m: Map<string, number>, n = 8) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    funnel: [
      { stage: "Screen visits", count: count("session_start") },
      { stage: "Product viewed", count: count("product_viewed") },
      { stage: "Product selected", count: count("added_to_mix") },
      { stage: "Checkout", count: count("checkout_started") },
      { stage: "Payment complete", count: count("payment_completed") },
    ],
    events: {
      taps: count("tap"),
      compares: count("products_compared"),
      ingredientInfoOpens: count("ingredient_info_opened"),
      filtersApplied: count("filter_applied"),
      limitBlocked: count("limit_blocked"),
      quizCompleted: count("quiz_completed"),
      paymentFailed: count("payment_failed"),
      abandoned: count("session_timeout"),
    },
    topViewedProducts: top(viewCounts),
    topIngredients: top(ingredientCounts),
    topFilterPaths: top(filterCounts),
  };
}
