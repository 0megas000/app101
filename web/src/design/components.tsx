import React, { useState } from "react";

/** Product art: soft gradient tile + glyph keyed by product.imageKey. */
const GLYPHS: Record<string, string> = {
  bolt: "⚡", wave: "🌊", sprout: "🌱", drop: "💧", zap: "✨", sun: "🌤",
  eye: "👁", leaf: "🍃", flame: "🔥", mountain: "⛰",
};

export function ProductArt({ imageKey, accentColor, size = 92, radius }: {
  imageKey: string; accentColor: string; size?: number; radius?: number;
}) {
  return (
    <div
      className="swatch"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? Math.round(size * 0.28),
        fontSize: size * 0.4,
        background: `radial-gradient(120% 120% at 30% 20%, ${accentColor}38, ${accentColor}0f 58%, transparent), var(--surface-2)`,
        border: `1px solid ${accentColor}40`,
        boxShadow: `inset 0 1px 0 ${accentColor}20`,
      }}
      aria-hidden
    >
      {GLYPHS[imageKey] ?? "🥤"}
    </div>
  );
}

export function Dots({ value, max = 5, color }: { value: number; max?: number; color?: string }) {
  return (
    <span className="dots" role="img" aria-label={`${value} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <i key={i} style={i < value ? { background: color ?? "var(--accent)" } : undefined} />
      ))}
    </span>
  );
}

export function Meter({ percent, color, height }: { percent: number; color?: string; height?: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="meter" style={height ? { height } : undefined}>
      <div style={{ width: `${clamped}%`, background: color ?? "var(--accent)" }} />
    </div>
  );
}

export function Modal({ onClose, children, wide }: { onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={wide ? { maxWidth: 880 } : undefined} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        {children}
      </div>
    </div>
  );
}

const SEVERITY: Record<string, { fg: string; bg: string; label: string; icon: string }> = {
  INFO: { fg: "var(--info-fg)", bg: "var(--info-soft)", label: "Info", icon: "ℹ" },
  CAUTION: { fg: "var(--warn-fg)", bg: "var(--warn-soft)", label: "Caution", icon: "⚠" },
  IMPORTANT: { fg: "var(--serious-fg)", bg: "var(--serious-soft)", label: "Important", icon: "!" },
  BLOCKING: { fg: "var(--danger-fg)", bg: "var(--danger-soft)", label: "Blocked", icon: "⛔" },
};

export function SeverityPill({ severity }: { severity: string }) {
  const s = SEVERITY[severity] ?? SEVERITY.INFO!;
  return (
    <span className="pill" style={{ background: s.bg, color: s.fg }}>
      <span aria-hidden>{s.icon}</span> {s.label}
    </span>
  );
}

export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="card stat-tile">
      <div className="label">{label}</div>
      <div className="value" style={accent ? { color: accent } : undefined}>{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

// ── Charts ───────────────────────────────────────────────────────────
// Single series, thin marks, recessive axes, hover tooltip, labels in ink.

interface TipState { x: number; y: number; text: string }

function useTip(): [TipState | null, (e: React.MouseEvent, text: string) => void, () => void] {
  const [tip, setTip] = useState<TipState | null>(null);
  return [
    tip,
    (e, text) => setTip({ x: e.clientX + 12, y: e.clientY - 34, text }),
    () => setTip(null),
  ];
}

export function Tip({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  return <div className="chart-tip" style={{ left: tip.x, top: tip.y }}>{tip.text}</div>;
}

export function BarChart({ data, height = 176, format }: {
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
            style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", minWidth: 3 }}
            onMouseMove={(e) => show(e, d.tooltip ?? `${d.label}: ${fmt(d.value)}`)}
            onMouseLeave={hide}
          >
            <div
              style={{
                height: `${(d.value / max) * 100}%`,
                minHeight: d.value > 0 ? 3 : 0,
                background: "var(--series-1)",
                borderRadius: "4px 4px 0 0",
                transition: "height var(--slow) var(--ease-out), opacity var(--fast) var(--ease-out)",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 2, marginTop: 7 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, fontSize: 10.5, color: "var(--text-3)", textAlign: "center", overflow: "hidden", whiteSpace: "nowrap", minWidth: 3 }}>
            {i % labelEvery === 0 ? d.label : ""}
          </div>
        ))}
      </div>
      <Tip tip={tip} />
    </div>
  );
}

export function HBarList({ data, format }: {
  data: { label: string; value: number; color?: string; sub?: string }[];
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const fmt = format ?? ((v: number) => String(v));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {data.map((d, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 5, gap: 12 }}>
            <span style={{ color: "var(--text)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.label}
              {d.sub ? <span style={{ color: "var(--text-3)", fontWeight: 400 }}> · {d.sub}</span> : null}
            </span>
            <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>{fmt(d.value)}</span>
          </div>
          <Meter percent={(d.value / max) * 100} color={d.color ?? "var(--series-1)"} height={7} />
        </div>
      ))}
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────

export function Spinner({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 44, color: "var(--text-2)" }}>
      <div style={{
        width: 32, height: 32, borderRadius: "50%",
        border: "2.5px solid var(--surface-3)", borderTopColor: "var(--accent)",
        animation: "spin 0.7s linear infinite",
      }} />
      <span style={{ fontSize: 14 }}>{label ?? "Loading…"}</span>
    </div>
  );
}

/** Skeleton block for content-shaped loading states. */
export function Skeleton({ height = 16, width = "100%", radius = 8 }: { height?: number; width?: string | number; radius?: number }) {
  return (
    <div style={{
      height, width, borderRadius: radius,
      background: "linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s linear infinite",
    }} />
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card" style={{ padding: 26, textAlign: "center", borderColor: "var(--danger-border)", background: "var(--danger-soft)" }}>
      <div style={{ fontSize: 26, marginBottom: 8 }} aria-hidden>⚠️</div>
      <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 14 }}>{message}</div>
      {onRetry ? <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button> : null}
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: string; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card rise-in" style={{ padding: 44, textAlign: "center", maxWidth: 520, margin: "36px auto" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>{icon}</div>
      <h3 style={{ fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 8 }}>{title}</h3>
      {body ? <p style={{ color: "var(--text-2)", marginBottom: 20, lineHeight: 1.55 }}>{body}</p> : null}
      {action}
    </div>
  );
}
