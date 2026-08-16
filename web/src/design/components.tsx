import React, { useState } from "react";

/** Product art: gradient tile + glyph keyed by product.imageKey. */
const GLYPHS: Record<string, string> = {
  bolt: "⚡", wave: "🌊", sprout: "🌱", drop: "💧", zap: "✨", sun: "🌤",
  eye: "👁", leaf: "🍃", flame: "🔥", mountain: "⛰",
};

export function ProductArt({ imageKey, accentColor, size = 96, radius = 18 }: { imageKey: string; accentColor: string; size?: number; radius?: number }) {
  return (
    <div
      className="swatch"
      style={{
        width: size, height: size, borderRadius: radius,
        fontSize: size * 0.42,
        background: `linear-gradient(140deg, ${accentColor}44, ${accentColor}18 60%, transparent), var(--bg-2)`,
        border: `1px solid ${accentColor}55`,
        flexShrink: 0,
      }}
      aria-hidden
    >
      {GLYPHS[imageKey] ?? "🥤"}
    </div>
  );
}

export function Dots({ value, max = 5, color }: { value: number; max?: number; color?: string }) {
  return (
    <span className="dots" aria-label={`${value} out of ${max}`}>
      <span className="on" style={color ? { color } : undefined}>{"●".repeat(value)}</span>
      <span className="off">{"●".repeat(Math.max(0, max - value))}</span>
    </span>
  );
}

export function Meter({ percent, color }: { percent: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="meter">
      <div style={{ width: `${clamped}%`, background: color ?? "var(--brand)" }} />
    </div>
  );
}

export function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 900 } : undefined} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

const SEVERITY_STYLE: Record<string, { bg: string; label: string; icon: string }> = {
  INFO: { bg: "#3987e5", label: "Info", icon: "ℹ️" },
  CAUTION: { bg: "#fab219", label: "Caution", icon: "⚠️" },
  IMPORTANT: { bg: "#ec835a", label: "Important", icon: "❗" },
  BLOCKING: { bg: "#d03b3b", label: "Blocked", icon: "⛔" },
};

export function SeverityPill({ severity }: { severity: string }) {
  const s = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.INFO!;
  return (
    <span className="pill" style={{ background: `${s.bg}26`, color: s.bg }}>
      <span aria-hidden>{s.icon}</span> {s.label}
    </span>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card stat-tile">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

// ── Charts: single-series, thin marks, hover tooltip, labels in ink ──

interface TipState { x: number; y: number; text: string }

function useTip(): [TipState | null, (e: React.MouseEvent, text: string) => void, () => void] {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = (e: React.MouseEvent, text: string) => setTip({ x: e.clientX + 12, y: e.clientY - 30, text });
  const hide = () => setTip(null);
  return [tip, show, hide];
}

export function Tip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>;
}

/** Vertical bar chart — one measure, one hue, 2px gaps, rounded data ends. */
export function BarChart({ data, height = 180, format }: {
  data: { label: string; value: number; tooltip?: string }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const [tip, show, hide] = useTip();
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format ?? ((v: number) => String(v));
  const labelEvery = Math.max(1, Math.ceil(data.length / 10));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", cursor: "default", minWidth: 3 }}
            onMouseMove={(e) => show(e, d.tooltip ?? `${d.label}: ${fmt(d.value)}`)}
            onMouseLeave={hide}
          >
            <div
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 3 : 0,
                background: "var(--series-1)",
                borderRadius: "4px 4px 0 0",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, fontSize: 10.5, color: "var(--ink-3)", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", minWidth: 3 }}>
            {i % labelEvery === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}

/** Horizontal bar list — labels + values in ink, single hue (or per-row status color). */
export function HBarList({ data, format }: {
  data: { label: string; value: number; color?: string; sub?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "var(--ink-1)", fontWeight: 600 }}>{d.label}{d.sub ? <span style={{ color: "var(--ink-3)", fontWeight: 400 }}> · {d.sub}</span> : null}</span>
            <span style={{ color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{fmt(d.value)}</span>
          </div>
          <div className="meter" style={{ height: 8 }}>
            <div style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? "var(--series-1)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 48, color: "var(--ink-2)" }}>
      <div style={{ width: 36, height: 36, border: "3px solid var(--bg-3)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {label ?? "Loading…"}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card" style={{ padding: 24, textAlign: "center", borderColor: "var(--bad)" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }} aria-hidden>⚠️</div>
      <div style={{ color: "var(--ink-1)", fontWeight: 600, marginBottom: 12 }}>{message}</div>
      {onRetry ? <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}
