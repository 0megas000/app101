import React, { useMemo, useState } from "react";
import { useKiosk } from "./KioskApp";
import type { ProductCard } from "../api/client";
import { ProductArt, Dots, EmptyState } from "../design/components";

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
    const present = new Set(products.flatMap((p) => p.tags.map((t) => t.slug)));
    return FILTER_ORDER
      .filter((slug) => present.has(slug))
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
    setCompareIds(compareIds.includes(id) ? compareIds.filter((x) => x !== id) : [...compareIds, id].slice(-2));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12, marginBottom: 4 }}>
        <div>
          <h2 style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}>Choose your pre-workout</h2>
          <p style={{ color: "var(--text-2)", fontSize: 14.5, marginTop: 3 }}>
            {filtered.length} {filtered.length === 1 ? "option" : "options"}
            {active.length > 0 ? " matching your filters" : " available now"}
          </p>
        </div>
        <button
          className={`chip ${compareMode ? "active" : ""}`}
          onClick={() => { setCompareMode(!compareMode); setCompareIds([]); }}
        >
          ⚖ {compareMode ? "Cancel compare" : "Compare"}
        </button>
      </div>

      <div className="filter-row">
        <button className={`chip ${active.length === 0 ? "active" : ""}`} onClick={() => setActive([])}>
          All
        </button>
        {chips.map((c) => (
          <button key={c.slug} className={`chip ${active.includes(c.slug) ? "active" : ""}`} onClick={() => toggleFilter(c.slug)}>
            {c.label}
          </button>
        ))}
      </div>

      {compareMode ? (
        <div
          className="card fade-in"
          style={{ padding: "12px 18px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderColor: "var(--accent)", background: "var(--accent-soft)" }}
        >
          <span style={{ color: "var(--text-2)", fontSize: 14.5 }}>
            {compareIds.length === 0 ? "Tap two products to compare them side by side."
              : compareIds.length === 1 ? "Pick one more product."
              : "Ready to compare."}
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={compareIds.length !== 2}
            onClick={() => { track("products_compared", { productIds: compareIds }); go("compare"); }}
          >
            Compare →
          </button>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nothing matches those filters"
          body="Try removing one to widen the search."
          action={<button className="btn btn-ghost" onClick={() => setActive([])}>Clear filters</button>}
        />
      ) : (
        <div className="product-grid stagger" key={active.join(",")}>
          {filtered.map((p, i) => (
            <ProductCardView
              key={p.id}
              index={i}
              product={p}
              inCart={cart.some((c) => c.productId === p.id)}
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
  const map = {
    BEGINNER: ["Beginner", "var(--good-fg)", "var(--good-soft)"],
    INTERMEDIATE: ["Intermediate", "var(--warn-fg)", "var(--warn-soft)"],
    ADVANCED: ["Advanced", "var(--serious-fg)", "var(--serious-soft)"],
  } as const;
  const [label, fg, bg] = map[strength];
  return <span className="pill" style={{ background: bg, color: fg }}>{label}</span>;
}

function ProductCardView({ product: p, index, inCart, compareMode, compareSelected, onTap, onAdd }: {
  product: ProductCard;
  index: number;
  inCart: boolean;
  compareMode: boolean;
  compareSelected: boolean;
  onTap: () => void;
  onAdd: () => void;
}) {
  const hasBadge = p.featured || p.staffPick;
  return (
    <div
      className={`card ${p.available ? "card-interactive" : ""}`}
      onClick={p.available ? onTap : undefined}
      style={{
        padding: "12px 18px 18px",
        opacity: p.available ? 1 : 0.5,
        borderColor: compareSelected ? "var(--accent)" : undefined,
        boxShadow: compareSelected ? "var(--shadow-accent)" : undefined,
        position: "relative",
        display: "flex",
        flexDirection: "column",
        ["--i" as string]: index,
      }}
    >
      {/* Reserved badge row — always present so every card aligns, whether
          or not this product carries a badge. */}
      <div style={{ height: 22, display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
        {hasBadge && (
          <span className="pill" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
            {p.staffPick ? "★ Staff pick" : "Featured"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        <ProductArt imageKey={p.imageKey} accentColor={p.accentColor} size={84} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" }}>{p.brand}</div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", lineHeight: 1.15, marginTop: 1 }}>{p.name}</div>
          <div style={{ fontSize: 13.5, color: "var(--text-2)" }}>{p.flavor}</div>
          <div style={{ fontSize: 17, fontWeight: 700, marginTop: 6, letterSpacing: "-0.02em" }}>
            ${(p.pricePerScoopCents / 100).toFixed(2)}
            <span style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500 }}> / scoop</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "9px 14px", margin: "16px 0 13px" }}>
        <Metric label="Energy" value={<Dots value={p.energyRating} color={p.accentColor} />} />
        <Metric label="Pump" value={<Dots value={p.pumpRating} color={p.accentColor} />} />
        <Metric label="Tingle" value={<Dots value={p.tingleRating} color={p.accentColor} />} />
        <Metric
          label="Caffeine"
          value={<b style={{ fontSize: 14.5, letterSpacing: "-0.02em" }}>{p.caffeineMgPerScoop > 0 ? `${p.caffeineMgPerScoop} mg` : "None"}</b>}
        />
      </div>

      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: "auto" }}>
        <StrengthBadge strength={p.strength} />
        <span className="pill" style={{
          background: p.isStimulant ? "var(--serious-soft)" : "var(--good-soft)",
          color: p.isStimulant ? "var(--serious-fg)" : "var(--good-fg)",
        }}>
          {p.isStimulant ? "⚡ Stim" : "☾ Non-stim"}
        </span>
        {p.lowStock && p.available ? <span className="pill" style={{ background: "var(--warn-soft)", color: "var(--warn-fg)" }}>Low stock</span> : null}
        {!p.available ? <span className="pill" style={{ background: "var(--surface-3)", color: "var(--text-3)" }}>Sold out</span> : null}
      </div>

      {!compareMode && p.available ? (
        <button
          className={`btn ${inCart ? "btn-ghost" : "btn-primary"} btn-sm`}
          style={{ width: "100%", marginTop: 14, minHeight: 44 }}
          onClick={(e) => { e.stopPropagation(); if (!inCart) onAdd(); }}
        >
          {inCart ? "✓ In your mix" : "Add to mix"}
        </button>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: "var(--text-3)", fontWeight: 650, letterSpacing: "0.06em", fontSize: 10, textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div>{value}</div>
    </div>
  );
}
