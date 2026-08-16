import React, { useEffect, useRef, useState } from "react";
import { useKiosk } from "./KioskApp";
import { kioskApi, formatCents, type Order } from "../api/client";
import { ProductArt, Meter, SeverityPill, Spinner, ErrorBox } from "../design/components";

export function CartFlow() {
  const { screen } = useKiosk();
  if (screen === "warnings") return <WarningsScreen />;
  if (screen === "summary") return <SummaryScreen />;
  if (screen === "dispensing") return <DispensingScreen />;
  if (screen === "complete") return <CompleteScreen />;
  return <CartScreen />;
}

// ── Serving selection + mixing + live safety meters (spec §7, §8) ────

function CartScreen() {
  const { cart, setCart, products, quote, quoteLoading, go, track } = useKiosk();

  if (cart.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: "center", maxWidth: 560, margin: "40px auto" }}>
        <div style={{ fontSize: 44 }} aria-hidden>🥤</div>
        <h3 style={{ fontSize: 22, fontWeight: 700, margin: "12px 0" }}>Your mix is empty</h3>
        <p style={{ color: "var(--text-2)", marginBottom: 20 }}>Add a pre-workout — or mix two — and we'll track the totals for you.</p>
        <button className="btn btn-primary" onClick={() => go("browse")}>Browse products</button>
      </div>
    );
  }

  const setScoops = (productId: string, scoops: number) => {
    setCart((prev) => prev.map((i) => (i.productId === productId ? { ...i, scoops } : i)));
  };
  const remove = (productId: string) => setCart((prev) => prev.filter((i) => i.productId !== productId));

  return (
    <div className="fade-in" style={{ maxWidth: 1140, margin: "0 auto", display: "grid", gridTemplateColumns: "minmax(420px, 1.5fr) minmax(320px, 1fr)", gap: 24, alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <h2 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>Your mix</h2>
        {cart.map((item) => {
          const p = products.find((x) => x.id === item.productId);
          if (!p) return null;
          return (
            <div key={item.productId} className="card" style={{ padding: 18, display: "flex", gap: 16, alignItems: "center", position: "relative" }}>
              <ProductArt imageKey={p.imageKey} accentColor={p.accentColor} size={64} radius={14} />
              <div style={{ flex: 1, minWidth: 120, paddingRight: 34 }}>
                <div style={{ fontWeight: 700, fontSize: 17 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-2)" }}>{p.brand} · {p.flavor}</div>
                <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 2 }}>
                  {p.caffeineMgPerScoop > 0 ? `${p.caffeineMgPerScoop * item.scoops} mg caffeine` : "Caffeine-free"} · {(p.servingSizeGrams * item.scoops).toFixed(0)} g
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                {Array.from({ length: p.maxScoopsPerServing }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    className={`chip ${item.scoops === n ? "active" : ""}`}
                    style={{ minWidth: 92 }}
                    onClick={() => setScoops(item.productId, n)}
                  >
                    {n} scoop{n > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ position: "absolute", top: 10, right: 10, minHeight: 32, padding: "0 10px" }}
                onClick={() => remove(item.productId)}
                aria-label={`Remove ${p.name}`}
              >
                ✕
              </button>
            </div>
          );
        })}
        <button className="btn btn-ghost" onClick={() => go("browse")}>+ Add another product</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 0 }}>
        <SafetyPanel />
        <div className="card" style={{ padding: 20 }}>
          {quote && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 15, color: "var(--text-2)", marginBottom: 6 }}>
                <span>Total serving</span><span>{quote.totalGrams} g</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, fontWeight: 750 }}>
                <span>Total</span><span style={{ letterSpacing: "-0.03em" }}>{formatCents(quote.totalCents)}</span>
              </div>
            </>
          )}
          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 16 }}
            disabled={!quote || !quote.allowed || quoteLoading}
            onClick={() => { track("checkout_started"); go("warnings"); }}
          >
            {quoteLoading ? "Checking…" : quote && !quote.allowed ? "Fix selection to continue" : "Continue →"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Live ingredient-limit meters + violations with suggestions (spec §8). */
function SafetyPanel() {
  const { quote, quoteLoading, cart, setCart, products } = useKiosk();
  if (!quote && quoteLoading) return <div className="card" style={{ padding: 20 }}><Spinner label="Calculating totals…" /></div>;
  if (!quote) return null;

  const applySuggestion = (text: string) => {
    // Suggestions are human sentences; map the two known shapes onto actions.
    const removeMatch = text.match(/^Remove (.+) to continue/);
    const scoopMatch = text.match(/^You could choose (\d+) scoops? of (.+) instead/);
    if (removeMatch) {
      const p = products.find((x) => x.name === removeMatch[1]);
      if (p) setCart(cart.filter((i) => i.productId !== p.id));
    } else if (scoopMatch) {
      const p = products.find((x) => x.name === scoopMatch[2]);
      if (p) setCart(cart.map((i) => (i.productId === p.id ? { ...i, scoops: Number(scoopMatch[1]) } : i)));
    }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15, letterSpacing: "0.04em" }}>SAFETY TRACKER</div>
      {quote.limits.length === 0 && <div style={{ color: "var(--text-3)", fontSize: 14 }}>No limited ingredients in this mix.</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {quote.limits.map((l) => (
          <div key={l.ingredientId}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 4 }}>
              <span style={{ fontWeight: 700 }}>{l.ingredientName}</span>
              <span style={{ color: l.exceeded ? "var(--danger-fg)" : "var(--text-2)", fontWeight: l.exceeded ? 800 : 500 }}>
                {l.amount} / {l.max} {l.unit}
              </span>
            </div>
            <Meter percent={(l.amount / l.max) * 100} color={l.exceeded ? "var(--danger-fg)" : l.amount / l.max > 0.8 ? "var(--warn-fg)" : "var(--good-fg)"} />
          </div>
        ))}
      </div>

      {quote.violations.length > 0 && (
        <div
          className="fade-in"
          style={{ marginTop: 16, background: "var(--danger-soft)", border: "1px solid var(--danger-border)", borderRadius: "var(--r)", padding: 15 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {quote.violations.map((v, i) => (
              <div key={i} style={{ fontWeight: 600, fontSize: 13.5, display: "flex", gap: 8, lineHeight: 1.45 }}>
                <span aria-hidden style={{ flexShrink: 0 }}>⛔</span>{v.message}
              </div>
            ))}
          </div>

          {/* One deduplicated set of fixes — two limits often share the same
              remedy, and repeating the button reads as a bug. */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
            {[...new Set(quote.violations.flatMap((v) => v.suggestions))].map((s) => (
              <button key={s} className="btn btn-ghost btn-sm" onClick={() => applySuggestion(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {quote.totals.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary style={{ color: "var(--text-3)", fontSize: 13, cursor: "pointer" }}>All ingredient totals</summary>
          <table className="table" style={{ marginTop: 8, fontSize: 13 }}>
            <tbody>
              {quote.totals.map((t) => (
                <tr key={t.ingredientId}>
                  <td>{t.name}</td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>{t.amount} {t.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

// ── Warning review + acknowledgement (spec §9, §26) ──────────────────

function WarningsScreen() {
  const { quote, acknowledged, setAcknowledged, go, track } = useKiosk();
  if (!quote) { go("cart"); return null; }

  const needsAck = quote.warnings.filter((w) => w.requiresAcknowledgement || w.severity === "IMPORTANT");
  const allAcked = needsAck.every((w) => acknowledged.has(w.id));

  const toggle = (id: string) => {
    setAcknowledged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 750, marginBottom: 6 }}>Before you continue</h2>
      <p style={{ color: "var(--text-2)", marginBottom: 20 }}>Please review the information for your selection. This is product information, not medical advice.</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {quote.warnings.length === 0 && (
          <div className="card" style={{ padding: 24, color: "var(--text-2)" }}>No specific warnings apply to this selection.</div>
        )}
        {quote.warnings.map((w) => {
          const requires = w.requiresAcknowledgement || w.severity === "IMPORTANT";
          return (
            <div
              key={w.id}
              className="card"
              onClick={requires ? () => toggle(w.id) : undefined}
              style={{ padding: 18, display: "flex", gap: 14, alignItems: "flex-start", cursor: requires ? "pointer" : "default", borderColor: requires && !acknowledged.has(w.id) ? "var(--warn-fg)" : undefined }}
            >
              {requires && (
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  border: `2px solid ${acknowledged.has(w.id) ? "var(--good-fg)" : "var(--text-3)"}`,
                  background: acknowledged.has(w.id) ? "var(--good-soft)" : "transparent",
                  color: "var(--good-fg)", fontWeight: 750,
                }}>
                  {acknowledged.has(w.id) ? "✓" : ""}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4, flexWrap: "wrap" }}>
                  <SeverityPill severity={w.severity} />
                  <span style={{ fontWeight: 700 }}>{w.title}</span>
                </div>
                <div style={{ color: "var(--text-2)", fontSize: 14.5, lineHeight: 1.5 }}>{w.body}</div>
                {requires && <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 6 }}>Tap to confirm you have read this.</div>}
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="btn btn-primary btn-xl"
        style={{ width: "100%", marginTop: 24 }}
        disabled={!allAcked}
        onClick={() => { track("warnings_acknowledged"); go("summary"); }}
      >
        {allAcked ? "I understand — continue" : `Confirm ${needsAck.filter((w) => !acknowledged.has(w.id)).length} remaining`}
      </button>
    </div>
  );
}

// ── Order summary + simulated payment (spec §10) ─────────────────────

function SummaryScreen() {
  const { quote, cart, sessionId, acknowledged, go, setOrderId, track } = useKiosk();
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!quote) { go("cart"); return null; }

  const caffeine = quote.totals.find((t) => t.name === "Caffeine");

  const pay = async () => {
    setPaying(true); setError(null);
    try {
      const order = await kioskApi.order({ sessionId, items: cart, acknowledgedWarningIds: [...acknowledged] });
      track("payment_completed", { totalCents: order.totalCents });
      setOrderId(order.id);
      go("dispensing");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Payment failed";
      track("payment_failed", { reason: message });
      setError(message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 750, marginBottom: 18 }}>Order summary</h2>
      <div className="card" style={{ padding: 24 }}>
        {quote.items.map((i) => (
          <div key={i.productId} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--surface-2)" }}>
            <div>
              <div style={{ fontWeight: 700 }}>{i.name} <span style={{ color: "var(--text-3)" }}>· {i.flavor}</span></div>
              <div style={{ fontSize: 13, color: "var(--text-2)" }}>{i.scoops} scoop{i.scoops > 1 ? "s" : ""} · {i.gramsTarget} g</div>
            </div>
            <div style={{ fontWeight: 700 }}>{formatCents(i.lineTotalCents)}</div>
          </div>
        ))}

        <div style={{ display: "flex", gap: 18, margin: "16px 0", flexWrap: "wrap" }}>
          <div className="pill" style={{ background: "var(--surface-2)", color: "var(--text-2)", fontSize: 13, textTransform: "none", letterSpacing: 0 }}>
            ☕ Total caffeine: <b>&nbsp;{caffeine ? `${caffeine.amount} mg` : "0 mg"}</b>
          </div>
          <div className="pill" style={{ background: "var(--surface-2)", color: "var(--text-2)", fontSize: 13, textTransform: "none", letterSpacing: 0 }}>
            ⚖️ {quote.totalGrams} g total
          </div>
          <div className="pill" style={{ background: "var(--surface-2)", color: "var(--text-2)", fontSize: 13, textTransform: "none", letterSpacing: 0 }}>
            ✓ {quote.warnings.length} warning{quote.warnings.length === 1 ? "" : "s"} reviewed
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, fontWeight: 750, marginTop: 8 }}>
          <span>Total</span>
          <span style={{ letterSpacing: "-0.03em" }}>{formatCents(quote.totalCents)}</span>
        </div>
      </div>

      {error && <div style={{ marginTop: 14 }}><ErrorBox message={error} /></div>}

      <button className="btn btn-primary btn-xl" style={{ width: "100%", marginTop: 20 }} disabled={paying} onClick={pay}>
        {paying ? "Processing payment…" : `💳 PAY NOW — ${formatCents(quote.totalCents)}`}
      </button>
      <div style={{ textAlign: "center", color: "var(--text-3)", fontSize: 13, marginTop: 10 }}>
        Simulated payment — card, Apple Pay, Google Pay and gym membership arrive with the payment-terminal integration.
      </div>
    </div>
  );
}

// ── Dispensing progress (spec §10, §11) ──────────────────────────────

function DispensingScreen() {
  const { orderId, go } = useKiosk();
  const [order, setOrder] = useState<Order | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderId) { go("cart"); return; }
    const poll = () => kioskApi.orderStatus(orderId).then((o) => {
      setOrder(o);
      if (o.status === "COMPLETED" || o.status === "FAILED") {
        if (timer.current) clearInterval(timer.current);
        go("complete");
      }
    }).catch(() => {});
    poll();
    timer.current = setInterval(poll, 800);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const steps = ["Measuring", "Dispensing", "Ready"];
  const activeStep = (s: string) => (s === "MEASURING" ? 0 : s === "DISPENSING" ? 1 : s === "READY" ? 2 : -1);

  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: "40px auto", textAlign: "center" }}>
      <h2 style={{ fontSize: 30, fontWeight: 750 }}>Preparing your pre-workout</h2>
      <div style={{ margin: "28px 0", fontSize: 64, animation: "pulse 1.4s ease infinite" }} aria-hidden>🥤</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {(order?.dispensing ?? []).map((d, i) => (
          <div key={i} className="card" style={{ padding: 18, textAlign: "left" }}>
            <div style={{ fontWeight: 700, marginBottom: 10 }}>{d.productName}</div>
            <div style={{ display: "flex", gap: 8 }}>
              {steps.map((label, si) => {
                const at = activeStep(d.status);
                const done = at > si || d.status === "READY";
                const current = at === si && d.status !== "READY";
                return (
                  <div key={label} style={{ flex: 1 }}>
                    <div className="meter" style={{ height: 6, marginBottom: 6 }}>
                      <div style={{ width: done ? "100%" : current ? "55%" : "0%", background: done ? "var(--good-fg)" : "var(--accent)" }} />
                    </div>
                    <div style={{ fontSize: 12.5, color: done || current ? "var(--text)" : "var(--text-3)", fontWeight: current ? 800 : 500 }}>
                      Step {si + 1}: {label}{done ? " ✓" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            {d.status === "FAULTED" && (
              <div style={{ color: "var(--danger-fg)", fontWeight: 700, marginTop: 10 }}>⚠️ {d.error ?? "Dispenser fault"}</div>
            )}
          </div>
        ))}
        {!order && <Spinner label="Contacting dispenser…" />}
      </div>
    </div>
  );
}

// ── Complete / failure screen with auto-return (spec §10) ────────────

function CompleteScreen() {
  const { orderId, bootstrap, resetToAttract } = useKiosk();
  const [order, setOrder] = useState<Order | null>(null);
  const seconds = Number(bootstrap.settings["kiosk.completeScreenSeconds"] ?? 12);
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (orderId) kioskApi.orderStatus(orderId).then(setOrder).catch(() => {});
  }, [orderId]);

  useEffect(() => {
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { if (left <= 0) resetToAttract(); }, [left, resetToAttract]);

  const failed = order?.status === "FAILED";
  return (
    <div className="fade-in" style={{ maxWidth: 560, margin: "48px auto", textAlign: "center" }}>
      <div style={{ fontSize: 84 }} aria-hidden>{failed ? "😕" : "💪"}</div>
      <h2 style={{ fontSize: 34, fontWeight: 750, margin: "16px 0 8px" }}>
        {failed ? "Something went wrong" : "Your pre-workout is ready!"}
      </h2>
      <p style={{ color: "var(--text-2)", fontSize: 17, lineHeight: 1.5 }}>
        {failed
          ? order?.failureReason ?? "The machine could not finish your order. You have not been charged."
          : "Grab your cup, add water, shake well — and have a great workout. Thank you!"}
      </p>
      {order && !failed && (
        <div className="pill" style={{ marginTop: 16, background: "var(--surface-2)", color: "var(--text-2)", textTransform: "none", letterSpacing: 0, fontSize: 13 }}>
          Receipt ref: {order.paymentRef ?? order.id.slice(-8).toUpperCase()}
        </div>
      )}
      <div style={{ marginTop: 32 }}>
        <button className="btn btn-primary" onClick={() => resetToAttract()}>Done</button>
        <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 12 }}>Returning to start in {Math.max(0, left)} s…</div>
      </div>
    </div>
  );
}
