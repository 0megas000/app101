import React, { useEffect, useState } from "react";
import { adminRequest, formatCents } from "../api/client";
import { BarChart, HBarList, StatTile, Spinner, ErrorBox } from "../design/components";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const toBars = (rows: { name: string; count: number }[]) => rows.map((r) => ({ label: r.name, value: r.count }));

function useAdminData<T>(path: string): { data: T | null; error: boolean; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState(false);
  const reload = () => {
    setError(false);
    adminRequest<T>(path).then(setData).catch(() => setError(true));
  };
  useEffect(reload, [path]);
  return { data, error, reload };
}

// ── Sales analytics (spec §15) ───────────────────────────────────────

interface SalesSeries {
  daily: { date: string; revenueCents: number; count: number }[];
  hourly: { hour: number; revenueCents: number; count: number }[];
  weekday: { weekday: number; revenueCents: number; count: number }[];
}

export function SalesAnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, error, reload } = useAdminData<SalesSeries>(`/analytics/sales?days=${days}`);

  if (error) return <ErrorBox message="Could not load sales analytics." onRetry={reload} />;
  if (!data) return <Spinner />;

  const totalRevenue = data.daily.reduce((s, d) => s + d.revenueCents, 0);
  const totalTx = data.daily.reduce((s, d) => s + d.count, 0);
  const bestHour = [...data.hourly].sort((a, b) => b.count - a.count)[0];
  const bestDay = [...data.weekday].sort((a, b) => b.count - a.count)[0];

  return (
    <div className="fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Sales Analytics</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {[7, 30, 90].map((d) => (
            <button key={d} className={`filter-chip ${days === d ? "active" : ""}`} style={{ minHeight: 38, fontSize: 13 }} onClick={() => setDays(d)}>
              Last {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 18 }}>
        <StatTile label={`Revenue (${days}d)`} value={formatCents(totalRevenue)} />
        <StatTile label="Transactions" value={String(totalTx)} />
        <StatTile label="Avg Transaction" value={totalTx ? formatCents(Math.round(totalRevenue / totalTx)) : "—"} />
        <StatTile label="Busiest Hour" value={bestHour ? `${String(bestHour.hour).padStart(2, "0")}:00` : "—"} sub={bestHour ? `${bestHour.count} transactions` : undefined} />
        <StatTile label="Busiest Day" value={bestDay ? WEEKDAYS[bestDay.weekday]! : "—"} sub={bestDay ? `${bestDay.count} transactions` : undefined} />
      </div>

      <h2 className="section-title">Revenue by day</h2>
      <div className="card" style={{ padding: 24 }}>
        <BarChart
          data={data.daily.map((d) => ({
            label: d.date.slice(5),
            value: d.revenueCents,
            tooltip: `${d.date}: ${formatCents(d.revenueCents)} · ${d.count} transactions`,
          }))}
          format={formatCents}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginTop: 20 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Transactions by hour of day</h3>
          <BarChart
            height={140}
            data={data.hourly.map((h) => ({
              label: String(h.hour).padStart(2, "0"),
              value: h.count,
              tooltip: `${String(h.hour).padStart(2, "0")}:00 — ${h.count} transactions · ${formatCents(h.revenueCents)}`,
            }))}
          />
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Revenue by day of week</h3>
          <HBarList
            data={data.weekday.map((w) => ({ label: WEEKDAYS[w.weekday]!, value: w.revenueCents, sub: `${w.count} tx` }))}
            format={formatCents}
          />
        </div>
      </div>
    </div>
  );
}

// ── Product analytics (spec §15) ─────────────────────────────────────

interface ProductPerf {
  products: { name: string; brand: string; flavor: string; purchases: number; revenueCents: number; oneScoop: number; twoScoop: number }[];
  mixedPurchases: number;
}

export function ProductAnalyticsPage() {
  const { data, error, reload } = useAdminData<ProductPerf>("/analytics/products");
  if (error) return <ErrorBox message="Could not load product analytics." onRetry={reload} />;
  if (!data) return <Spinner />;

  const sold = data.products.filter((p) => p.purchases > 0);
  const oneScoop = sold.reduce((s, p) => s + p.oneScoop, 0);
  const twoScoop = sold.reduce((s, p) => s + p.twoScoop, 0);
  const best = sold[0];
  const worst = [...data.products].sort((a, b) => a.purchases - b.purchases)[0];

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 18 }}>Product Analytics <span style={{ fontSize: 14, color: "var(--ink-3)", fontWeight: 500 }}>· last 30 days</span></h1>

      <div className="stat-grid">
        <StatTile label="Best Seller" value={best?.name ?? "—"} sub={best ? `${best.purchases} purchases · ${formatCents(best.revenueCents)}` : undefined} />
        <StatTile label="Least Popular" value={worst?.name ?? "—"} sub={worst ? `${worst.purchases} purchases` : undefined} />
        <StatTile label="1-Scoop Orders" value={String(oneScoop)} sub={`${Math.round((oneScoop / Math.max(1, oneScoop + twoScoop)) * 100)}% of items`} />
        <StatTile label="2-Scoop Orders" value={String(twoScoop)} sub={`${Math.round((twoScoop / Math.max(1, oneScoop + twoScoop)) * 100)}% of items`} />
        <StatTile label="Mixed Purchases" value={String(data.mixedPurchases)} sub="Orders with 2+ products" />
      </div>

      <h2 className="section-title">Revenue by product</h2>
      <div className="card" style={{ padding: 24 }}>
        <HBarList
          data={data.products.map((p) => ({ label: p.name, value: p.revenueCents, sub: `${p.brand} · ${p.flavor}` }))}
          format={formatCents}
        />
      </div>

      <h2 className="section-title">Detail</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Brand</th><th>Flavor</th><th>Purchases</th><th>1 scoop</th><th>2 scoops</th><th>Revenue</th></tr>
          </thead>
          <tbody>
            {data.products.map((p) => (
              <tr key={p.name + p.flavor}>
                <td style={{ fontWeight: 700 }}>{p.name}</td>
                <td style={{ color: "var(--ink-2)" }}>{p.brand}</td>
                <td style={{ color: "var(--ink-2)" }}>{p.flavor}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.purchases}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.oneScoop}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.twoScoop}</td>
                <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{formatCents(p.revenueCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Interaction analytics + funnel (spec §16) ────────────────────────

interface Interactions {
  funnel: { stage: string; count: number }[];
  events: Record<string, number>;
  topViewedProducts: { name: string; count: number }[];
  topIngredients: { name: string; count: number }[];
  topFilterPaths: { name: string; count: number }[];
}

export function InteractionAnalyticsPage() {
  const { data, error, reload } = useAdminData<Interactions>("/analytics/interactions");
  if (error) return <ErrorBox message="Could not load interaction analytics." onRetry={reload} />;
  if (!data) return <Spinner />;

  const top = data.funnel[0]?.count ?? 1;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>User Interaction Analytics</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 4 }}>
        Anonymous session data only — no personally identifiable information is collected.
      </p>

      <h2 className="section-title">Conversion funnel · last 30 days</h2>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {data.funnel.map((f, i) => {
            const pct = Math.round((f.count / Math.max(1, top)) * 100);
            const prev = data.funnel[i - 1]?.count;
            const stepPct = prev ? Math.round((f.count / Math.max(1, prev)) * 100) : null;
            return (
              <div key={f.stage}>
                {i > 0 && <div style={{ textAlign: "center", color: "var(--ink-3)", fontSize: 12, padding: "2px 0" }}>↓ {stepPct}%</div>}
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 160, fontSize: 13.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ink-2)" }}>{f.stage}</div>
                  <div style={{ flex: 1, background: "var(--bg-3)", borderRadius: 6, height: 34, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "var(--series-1)", borderRadius: "6px", display: "flex", alignItems: "center", paddingLeft: 12, fontSize: 13, fontWeight: 800, color: "#fff", minWidth: 60 }}>
                      {f.count}
                    </div>
                  </div>
                  <div style={{ width: 52, textAlign: "right", color: "var(--ink-3)", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="stat-grid" style={{ marginTop: 20 }}>
        <StatTile label="Comparisons" value={String(data.events.compares ?? 0)} />
        <StatTile label="Ingredient [?] Taps" value={String(data.events.ingredientInfoOpens ?? 0)} />
        <StatTile label="Filters Applied" value={String(data.events.filtersApplied ?? 0)} />
        <StatTile label="Quiz Completions" value={String(data.events.quizCompleted ?? 0)} />
        <StatTile label="Blocked by Limits" value={String(data.events.limitBlocked ?? 0)} sub="Safety engine interventions" />
        <StatTile label="Abandoned Sessions" value={String(data.events.abandoned ?? 0)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20, marginTop: 20 }}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Most viewed products</h3>
          <HBarList data={toBars(data.topViewedProducts)} />
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Most researched ingredients</h3>
          <HBarList data={toBars(data.topIngredients)} />
        </div>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>Common filter paths</h3>
          <HBarList data={toBars(data.topFilterPaths)} />
        </div>
      </div>
    </div>
  );
}
