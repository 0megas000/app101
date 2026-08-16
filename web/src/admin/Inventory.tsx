import React, { useEffect, useState } from "react";
import { adminRequest } from "../api/client";
import { Meter, Spinner, ErrorBox } from "../design/components";

interface Bin {
  id: string;
  machine: string;
  binNumber: number;
  product: { id: string; name: string; brand: string; flavor: string; servingSizeGrams: number; accentColor: string } | null;
  capacityGrams: number;
  currentGrams: number;
  percent: number;
  estimatedServings: number | null;
  low: boolean;
  lowThresholdGrams: number;
  lotNumber: string | null;
  expiresAt: string | null;
  lastRefillAt: string | null;
  disabled: boolean;
}

export function InventoryPage() {
  const [bins, setBins] = useState<Bin[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setError(false);
    adminRequest<Bin[]>("/inventory").then(setBins).catch(() => setError(true));
  };
  useEffect(load, []);

  // Live inventory pushes over WebSocket
  useEffect(() => {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; binId?: string; currentGrams?: number };
        if (msg.type === "inventory.updated" && msg.binId) {
          setBins((prev) => prev?.map((b) => (b.id === msg.binId
            ? { ...b, currentGrams: msg.currentGrams!, percent: Math.round((msg.currentGrams! / b.capacityGrams) * 100), low: msg.currentGrams! <= b.lowThresholdGrams, estimatedServings: b.product ? Math.floor(msg.currentGrams! / b.product.servingSizeGrams) : null }
            : b)) ?? null);
        }
      } catch { /* ignore */ }
    };
    return () => ws.close();
  }, []);

  const refill = async (bin: Bin) => {
    setBusy(bin.id);
    try {
      await adminRequest(`/inventory/${bin.id}/refill`, {
        method: "POST",
        body: JSON.stringify({ grams: bin.capacityGrams - bin.currentGrams, lotNumber: `LOT-${new Date().getFullYear()}-${Math.floor(Math.random() * 900 + 100)}` }),
      });
      load();
    } catch { setError(true); } finally { setBusy(null); }
  };

  const toggleDisabled = async (bin: Bin) => {
    setBusy(bin.id);
    try {
      await adminRequest(`/inventory/${bin.id}`, { method: "PATCH", body: JSON.stringify({ disabled: !bin.disabled }) });
      load();
    } catch { setError(true); } finally { setBusy(null); }
  };

  if (error && !bins) return <ErrorBox message="Could not load inventory." onRetry={load} />;
  if (!bins) return <Spinner />;

  const lowCount = bins.filter((b) => b.low && b.product).length;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Inventory</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 4 }}>
        Weight-tracked bins. {lowCount > 0 ? `⚠️ ${lowCount} bin${lowCount === 1 ? "" : "s"} below threshold.` : "All bins above threshold."}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16, marginTop: 20 }}>
        {bins.map((b) => (
          <div key={b.id} className="card" style={{ padding: 20, opacity: b.disabled ? 0.55 : 1, borderColor: b.low ? "var(--warn)" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontWeight: 700, letterSpacing: "0.08em" }}>
                  {b.machine} · BIN {b.binNumber}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>{b.product?.name ?? "Empty bin"}</div>
                {b.product && <div style={{ fontSize: 13, color: "var(--ink-2)" }}>{b.product.brand} · {b.product.flavor}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{b.percent}%</div>
                {b.low && <span className="pill" style={{ background: "rgba(250,178,25,0.18)", color: "var(--warn)" }}>⚠️ Low</span>}
                {b.disabled && <span className="pill" style={{ background: "var(--bg-3)", color: "var(--ink-3)" }}>Disabled</span>}
              </div>
            </div>

            <div style={{ margin: "14px 0 10px" }}>
              <Meter percent={b.percent} color={b.percent < 20 ? "var(--bad)" : b.percent < 40 ? "var(--warn)" : "var(--good)"} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 12.5, color: "var(--ink-2)" }}>
              <Row label="Current" value={`${Math.round(b.currentGrams).toLocaleString()} g`} />
              <Row label="Capacity" value={`${b.capacityGrams.toLocaleString()} g`} />
              <Row label="Est. servings" value={b.estimatedServings !== null ? String(b.estimatedServings) : "—"} />
              <Row label="Lot" value={b.lotNumber ?? "—"} />
              <Row label="Expires" value={b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "—"} />
              <Row label="Last refill" value={b.lastRefillAt ? new Date(b.lastRefillAt).toLocaleDateString() : "—"} />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={busy === b.id || b.percent >= 100} onClick={() => refill(b)}>
                {busy === b.id ? "…" : "Refill to full"}
              </button>
              <button className="btn btn-ghost btn-sm" disabled={busy === b.id} onClick={() => toggleDisabled(b)}>
                {b.disabled ? "Enable" : "Disable"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span style={{ color: "var(--ink-3)" }}>{label}</span>
      <span style={{ textAlign: "right", fontWeight: 600, color: "var(--ink-1)" }}>{value}</span>
    </>
  );
}
