import React from "react";
import { useKiosk } from "./KioskApp";
import { ProductArt, Dots } from "../design/components";
import { StrengthBadge } from "./Browse";

/** Side-by-side product comparison (spec §6). */
export function CompareScreen() {
  const { products, compareIds, go, addToCart } = useKiosk();
  const [a, b] = compareIds.map((id) => products.find((p) => p.id === id));
  if (!a || !b) {
    go("browse");
    return null;
  }

  const rows: { label: string; render: (p: typeof a) => React.ReactNode }[] = [
    { label: "Caffeine", render: (p) => <b>{p!.caffeineMgPerScoop > 0 ? `${p!.caffeineMgPerScoop} mg` : "0 mg"}</b> },
    { label: "Stimulant", render: (p) => (p!.isStimulant ? "⚡ Yes" : "🌙 No") },
    { label: "Energy", render: (p) => <Dots value={p!.energyRating} color={p!.accentColor} /> },
    { label: "Pump", render: (p) => <Dots value={p!.pumpRating} color={p!.accentColor} /> },
    { label: "Tingling", render: (p) => (p!.tingleRating === 0 ? "None" : <Dots value={p!.tingleRating} color={p!.accentColor} />) },
    { label: "Focus", render: (p) => <Dots value={p!.focusRating} color={p!.accentColor} /> },
    { label: "Strength", render: (p) => <StrengthBadge strength={p!.strength} /> },
    { label: "Serving size", render: (p) => `${p!.servingSizeGrams} g` },
    { label: "Price / scoop", render: (p) => <b style={{ color: "var(--brand-2)" }}>${(p!.pricePerScoopCents / 100).toFixed(2)}</b> },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: "0 auto" }}>
      <h2 style={{ fontSize: 30, fontWeight: 900, textAlign: "center", marginBottom: 24 }}>Compare</h2>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table" style={{ fontSize: 16 }}>
          <thead>
            <tr>
              <th style={{ width: "26%" }} />
              {[a, b].map((p) => (
                <th key={p!.id} style={{ textAlign: "center", padding: 20 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <ProductArt imageKey={p!.imageKey} accentColor={p!.accentColor} size={72} />
                    <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.08em" }}>{p!.brand}</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "var(--ink-1)", textTransform: "none", letterSpacing: 0 }}>{p!.name}</div>
                    <div style={{ fontSize: 13, color: "var(--ink-2)", textTransform: "none", letterSpacing: 0 }}>{p!.flavor}</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <td style={{ color: "var(--ink-3)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.06em" }}>{row.label}</td>
                <td style={{ textAlign: "center" }}>{row.render(a)}</td>
                <td style={{ textAlign: "center" }}>{row.render(b)}</td>
              </tr>
            ))}
            <tr>
              <td />
              {[a, b].map((p) => (
                <td key={p!.id} style={{ textAlign: "center", padding: 16 }}>
                  <button className="btn btn-primary btn-sm" disabled={!p!.available} onClick={() => { addToCart(p!.id); go("cart"); }}>
                    {p!.available ? "+ Add to mix" : "Sold out"}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
