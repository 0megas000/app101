import React, { useMemo, useState } from "react";
import { useKiosk } from "./KioskApp";
import type { ProductCard } from "../api/client";
import { ProductArt, Dots } from "../design/components";

/** Filter chips — driven by product tags plus metadata-derived filters (spec §3). */
const FILTER_ORDER = [
  "stim", "non-stim", "high-energy", "moderate-energy", "low-caffeine",
  "pump", "tingle", "no-tingle", "beginner", "advanced", "popular", "staff-pick",
  "focus", "performance",
];

export function BrowseScreen() {
  const { products, bootstrap, track, openProduct, compareIds, setCompareIds, go, cart, addToCart } = useKiosk();
  const [active, setActive] = useState<string[]>([]);
  const [compareMode, setCompareMode] = useState(false);

  const chips = useMemo(() => {
    const withProducts = new Set(products.flatMap((p) => p.tags.map((t) => t.slug)));
    return FILTER_ORDER
      .filter((slug) => withProducts.has(slug))
      .map((slug) => ({ slug, label: bootstrap.tags.find((t) => t.slug === slug)?.label ?? slug }));
  }, [products, bootstrap.tags]);

  const filtered = useMemo(
    () => products.filter((p) => active.every((slug) => p.tags.some((t) => t.slug === slug))),
    [products, active],
  );

  const toggleFilter = (slug: string) => {
    setActive((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      if (next.length > 0) track("filter_applied", { filters: next });
      return next;
    });
  };

  const toggleCompare = (id: string) => {
    setCompareIds(
      compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id].slice(-2),
    );
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900 }}>Choose your pre-workout</h2>
        <button
          className={`filter-chip ${compareMode ? "active" : ""}`}
          onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
        >
          ⚖️ {compareMode ? "Cancel compare" : "Compare products"}
        </button>
      </div>

      <div className="filter-row">
        <button className={`filter-chip ${active.length === 0 ? "active" : ""}`} onClick={() => setActive([])}>
          All Pre-Workouts
        </button>
        {chips.map((c) => (
          <button key={c.slug} className={`filter-chip ${active.includes(c.slug) ? "active" : ""}`} onClick={() => toggleFilter(c.slug)}>
            {c.label}
          </button>
        ))}
      </div>

      {compareMode ? (
        <div className="card" style={{ padding: "12px 20px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderColor: "var(--brand)" }}>
          <span style={{ color: "var(--ink-2)" }}>
            {compareIds.length === 0 ? "Tap two products to compare them side by side." : compareIds.length === 1 ? "Pick one more product." : "Ready to compare!"}
          </span>
          <button className="btn btn-primary btn-sm" disabled={compareIds.length !== 2} onClick={() => {
            track("products_compared", { productIds: compareIds });
            go("compare");
          }}>
            Compare →
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--ink-2)" }}>
          No products match those filters. Try removing one.
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((p) => (
            <ProductCardView
              key={p.id}
              product={p}
              inCart={cart.some((i) => i.productId === p.id)}
              compareMode={compareMode}
              compareSelected={compareIds.includes(p.id)}
              onTap={() => (compareMode ? toggleCompare(p.id) : openProduct(p.id))}
              onAdd={() => addToCart(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function StrengthBadge({ strength }: { strength: ProductCard["strength"] }) {
  const map = { BEGINNER: ["Beginner", "#0ca30c"], INTERMEDIATE: ["Intermediate", "#fab219"], ADVANCED: ["Advanced", "#d03b3b"] } as const;
  const [label, color] = map[strength];
  return <span className="pill" style={{ background: `${color}22`, color }}>{label}</span>;
}

function ProductCardView({ product: p, inCart, compareMode, compareSelected, onTap, onAdd }: {
  product: ProductCard;
  inCart: boolean;
  compareMode: boolean;
  compareSelected: boolean;
  onTap: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="card fade-in"
      onClick={p.available ? onTap : undefined}
      style={{
        padding: 20, cursor: p.available ? "pointer" : "default",
        opacity: p.available ? 1 : 0.45,
        outline: compareSelected ? "2.5px solid var(--brand)" : "none",
        position: "relative",
        display: "flex", flexDirection: "column",
      }}
    >
      {(p.featured || p.staffPick) && (
        <span className="pill" style={{ position: "absolute", top: 14, right: 14, background: "rgba(124,92,255,0.2)", color: "var(--brand-2)" }}>
          {p.staffPick ? "★ Staff pick" : "Featured"}
        </span>
      )}
      <div style={{ display: "flex", gap: 16 }}>
        <ProductArt imageKey={p.imageKey} accentColor={p.accentColor} />
        <div style={{ minWidth: 0, paddingRight: p.featured || p.staffPick ? 96 : 0 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{p.brand}</div>
          <div style={{ fontSize: 21, fontWeight: 800, lineHeight: 1.2 }}>{p.name}</div>
          <div style={{ fontSize: 14, color: "var(--ink-2)" }}>{p.flavor}</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6, color: "var(--brand-2)" }}>
            ${(p.pricePerScoopCents / 100).toFixed(2)} <span style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>/ scoop</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", margin: "16px 0 12px", fontSize: 12.5 }}>
        <Metric label="ENERGY" value={<Dots value={p.energyRating} color={p.accentColor} />} />
        <Metric label="PUMP" value={<Dots value={p.pumpRating} color={p.accentColor} />} />
        <Metric label="TINGLING" value={<Dots value={p.tingleRating} color={p.accentColor} />} />
        <Metric label="CAFFEINE" value={<b style={{ fontSize: 15 }}>{p.caffeineMgPerScoop > 0 ? `${p.caffeineMgPerScoop} mg` : "None"}</b>} />
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: "auto" }}>
        <StrengthBadge strength={p.strength} />
        <span className="pill" style={{ background: p.isStimulant ? "rgba(236,131,90,0.18)" : "rgba(12,163,12,0.18)", color: p.isStimulant ? "#ec835a" : "#0ca30c" }}>
          {p.isStimulant ? "⚡ Stim" : "🌙 Non-stim"}
        </span>
        {p.lowStock && p.available ? <span className="pill" style={{ background: "rgba(250,178,25,0.16)", color: "var(--warn)" }}>Low stock</span> : null}
        {!p.available ? <span className="pill" style={{ background: "var(--bg-3)", color: "var(--ink-3)" }}>Sold out</span> : null}
      </div>

      {!compareMode && p.available ? (
        <button
          className={`btn ${inCart ? "btn-ghost" : "btn-primary"} btn-sm`}
          style={{ width: "100%", marginTop: 14 }}
          onClick={(e) => { e.stopPropagation(); if (!inCart) onAdd(); }}
        >
          {inCart ? "✓ In your mix" : "+ Add to mix"}
        </button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--ink-3)", fontWeight: 700, letterSpacing: "0.08em", fontSize: 10.5 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
