import React, { useEffect, useState } from "react";
import { useKiosk } from "./KioskApp";
import { kioskApi, type IngredientInfo, type ProductDetail } from "../api/client";
import { ProductArt, Dots, Modal, SeverityPill, Spinner, ErrorBox } from "../design/components";
import { StrengthBadge } from "./Browse";

export function DetailScreen() {
  const { selectedProductId, addToCart, cart, go, track } = useKiosk();
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [error, setError] = useState(false);
  const [ingredient, setIngredient] = useState<IngredientInfo | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [showFacts, setShowFacts] = useState(false);

  useEffect(() => {
    if (!selectedProductId) return;
    setDetail(null); setError(false);
    kioskApi.product(selectedProductId).then(setDetail).catch(() => setError(true));
  }, [selectedProductId]);

  if (error) return <ErrorBox message="Could not load this product." onRetry={() => go("browse")} />;
  if (!detail) return <Spinner />;
  const inCart = cart.some((i) => i.productId === detail.id);

  const openIngredient = (ingredientId: string, name: string) => {
    track("ingredient_info_opened", { ingredient: name });
    setShowTechnical(false);
    kioskApi.ingredient(ingredientId).then(setIngredient).catch(() => {});
  };

  const tingleText = detail.tingleRating >= 4 ? "Strong tingling" : detail.tingleRating >= 2 ? "Moderate tingling" : detail.tingleRating > 0 ? "Mild tingling" : "No tingling";

  return (
    <div className="fade-in" style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        <ProductArt imageKey={detail.imageKey} accentColor={detail.accentColor} size={168} radius={30} />
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{detail.brand}</div>
          <h2 style={{ fontSize: 40, fontWeight: 750, lineHeight: 1.05 }}>{detail.name}</h2>
          <div style={{ fontSize: 19, color: "var(--text-2)", marginBottom: 10 }}>{detail.flavor}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <StrengthBadge strength={detail.strength} />
            <span className="pill" style={{ background: detail.isStimulant ? "var(--serious-soft)" : "var(--good-soft)", color: detail.isStimulant ? "var(--serious-fg)" : "var(--good-fg)" }}>
              {detail.isStimulant ? "⚡ Stimulant" : "🌙 Non-stim"}
            </span>
            <span className="pill" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>{tingleText}</span>
            {detail.dietary?.vegan ? <span className="pill" style={{ background: "var(--good-soft)", color: "var(--good-fg)" }}>Vegan</span> : null}
            {detail.dietary?.dyeFree ? <span className="pill" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>Dye-free</span> : null}
          </div>
          <p style={{ color: "var(--text-2)", fontSize: 16, lineHeight: 1.55, maxWidth: 640 }}>{detail.description}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
            <div style={{ fontSize: 30, fontWeight: 750, letterSpacing: "-0.03em" }}>
              ${(detail.pricePerScoopCents / 100).toFixed(2)}
              <span style={{ fontSize: 14, color: "var(--text-3)", fontWeight: 500 }}> / scoop · {detail.servingSizeGrams} g</span>
            </div>
            <button className={`btn ${inCart ? "btn-ghost" : "btn-primary"}`} disabled={!detail.available}
              onClick={() => { if (!inCart) addToCart(detail.id); go("cart"); }}>
              {detail.available ? (inCart ? "✓ In your mix — view" : "+ Add to my mix") : "Sold out"}
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", alignContent: "start", minWidth: 200 }}>
          <RatingRow label="ENERGY" value={detail.energyRating} color={detail.accentColor} />
          <RatingRow label="PUMP" value={detail.pumpRating} color={detail.accentColor} />
          <RatingRow label="TINGLING" value={detail.tingleRating} color={detail.accentColor} />
          <RatingRow label="FOCUS" value={detail.focusRating} color={detail.accentColor} />
        </div>
      </div>

      <h3 className="section-title">Major ingredients — tap [?] to learn what each does</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 14 }}>
        {detail.majorIngredients.map((mi) => (
          <div key={mi.ingredientId} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{mi.name}</div>
              <div style={{ fontSize: 24, fontWeight: 750, marginTop: 2 }}>{mi.amountPerScoop} {mi.unit}</div>
            </div>
            <button
              className="btn btn-ghost"
              style={{ minHeight: 48, minWidth: 48, borderRadius: "50%", padding: 0, fontSize: 18, fontWeight: 700, color: "var(--accent)" }}
              onClick={() => openIngredient(mi.ingredientId, mi.name)}
              aria-label={`Learn about ${mi.name}`}
            >
              ?
            </button>
          </div>
        ))}
      </div>

      {detail.warnings.length > 0 && (
        <>
          <h3 className="section-title">Important information</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {detail.warnings.map((w) => (
              <div key={w.id} className="card" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
                <SeverityPill severity={w.severity} />
                <div>
                  <div style={{ fontWeight: 700 }}>{w.title}</div>
                  <div style={{ color: "var(--text-2)", fontSize: 14, marginTop: 2 }}>{w.body}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => setShowFacts(true)}>
        📋 Full Supplement Facts
      </button>

      {showFacts && (
        <Modal onClose={() => setShowFacts(false)}>
          <h3 style={{ fontSize: 24, fontWeight: 750, marginBottom: 4 }}>Supplement Facts</h3>
          <div style={{ color: "var(--text-2)", marginBottom: 16 }}>{detail.brand} {detail.name} — per {detail.servingSizeGrams} g scoop</div>
          <table className="table">
            <tbody>
              {detail.supplementFacts.map((f, i) => (
                <tr key={i}>
                  <td>{f.label}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{f.amount} {f.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={() => setShowFacts(false)}>Close</button>
        </Modal>
      )}

      {ingredient && (
        <Modal onClose={() => setIngredient(null)}>
          <h3 style={{ fontSize: 28, fontWeight: 750 }}>{ingredient.name}</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 18 }}>
            <InfoBlock title="What does it do?" body={ingredient.plainExplanation} />
            <InfoBlock title="What might you feel?" body={ingredient.sensation} />
            <InfoBlock
              title="How strong is the dose in this serving?"
              body={`${detail.allIngredients.find((x) => x.ingredientId === ingredient.id)?.amountPerScoop ?? "—"} ${ingredient.unit} per scoop. Typical range: ${ingredient.typicalDoseMin}–${ingredient.typicalDoseMax} ${ingredient.unit}.`}
            />
            {ingredient.warningInfo ? <InfoBlock title="Good to know" body={ingredient.warningInfo} /> : null}
            {showTechnical ? (
              <InfoBlock title="Learn more" body={ingredient.technicalExplanation} />
            ) : (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowTechnical(true)}>Learn more (technical)</button>
            )}
          </div>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 24 }} onClick={() => setIngredient(null)}>Got it</button>
        </Modal>
      )}
    </div>
  );
}

function RatingRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <>
      <div style={{ color: "var(--text-3)", fontWeight: 700, fontSize: 12, letterSpacing: "0.08em" }}>{label}</div>
      <Dots value={value} color={color} />
    </>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--accent)" }}>{title}</div>
      <div style={{ color: "var(--text-2)", lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
