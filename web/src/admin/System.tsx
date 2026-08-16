import React, { useEffect, useState } from "react";
import { adminRequest } from "../api/client";
import { Spinner, ErrorBox } from "../design/components";

// ── Promotions / idle screen playlist (spec §21) ─────────────────────

interface Promotion {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  productId: string | null;
  accentColor: string;
  sortOrder: number;
  active: boolean;
}

export function PromotionsPage() {
  const [items, setItems] = useState<Promotion[] | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({ title: "", subtitle: "", accentColor: "var(--accent)" });

  const load = () => {
    setError(false);
    adminRequest<Promotion[]>("/promotions").then(setItems).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !items) return <ErrorBox message="Could not load promotions." onRetry={load} />;
  if (!items) return <Spinner />;

  const toggle = async (p: Promotion) => {
    setBusy(true);
    try {
      await adminRequest(`/promotions/${p.id}`, { method: "PUT", body: JSON.stringify({ active: !p.active }) });
      load();
    } finally { setBusy(false); }
  };

  const remove = async (p: Promotion) => {
    setBusy(true);
    try {
      await adminRequest(`/promotions/${p.id}`, { method: "DELETE" });
      load();
    } finally { setBusy(false); }
  };

  const create = async () => {
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      await adminRequest("/promotions", {
        method: "POST",
        body: JSON.stringify({
          kind: "MESSAGE",
          title: draft.title,
          subtitle: draft.subtitle || null,
          accentColor: draft.accentColor,
          sortOrder: (items.at(-1)?.sortOrder ?? 0) + 1,
          active: true,
        }),
      });
      setDraft({ title: "", subtitle: "", accentColor: "var(--accent)" });
      load();
    } finally { setBusy(false); }
  };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>Promotions & Idle Screen</h1>
      <p style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>
        The attract screen cycles through active entries in order. Product features show that product's artwork.
      </p>

      <div className="card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Add a message slide</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1.6fr auto auto", gap: 10, alignItems: "center" }}>
          <input placeholder="Headline (e.g. Need Energy?)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <input placeholder="Subtitle" value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} />
          <input type="color" value={draft.accentColor} onChange={(e) => setDraft({ ...draft, accentColor: e.target.value })} style={{ width: 52, height: 40, padding: 3 }} />
          <button className="btn btn-primary btn-sm" disabled={busy || !draft.title.trim()} onClick={create}>Add slide</button>
        </div>
      </div>

      <div className="card" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="table">
          <thead><tr><th>Order</th><th>Kind</th><th>Title</th><th>Subtitle</th><th>Accent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {items.map((p) => (
              <tr key={p.id}>
                <td style={{ color: "var(--text-3)" }}>{p.sortOrder}</td>
                <td style={{ fontSize: 12, color: "var(--text-2)" }}>{p.kind.replace("_", " ").toLowerCase()}</td>
                <td style={{ fontWeight: 700 }}>{p.title}</td>
                <td style={{ color: "var(--text-2)", fontSize: 13, maxWidth: 320 }}>{p.subtitle ?? "—"}</td>
                <td><span style={{ display: "inline-block", width: 20, height: 20, borderRadius: 5, background: p.accentColor, verticalAlign: "middle" }} /></td>
                <td>{p.active ? <span style={{ color: "var(--good-fg)" }}>● Live</span> : <span style={{ color: "var(--text-3)" }}>○ Paused</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => toggle(p)}>{p.active ? "Pause" : "Activate"}</button>{" "}
                  <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── System settings ──────────────────────────────────────────────────

const SETTING_LABELS: Record<string, { label: string; help: string }> = {
  "kiosk.idleTimeoutSeconds": { label: "Idle timeout (seconds)", help: "Returns the kiosk to the attract screen after inactivity. Never interrupts an active dispense." },
  "kiosk.completeScreenSeconds": { label: "Order complete screen (seconds)", help: "How long the thank-you screen stays up before returning to idle." },
  "kiosk.attractRotationSeconds": { label: "Attract slide rotation (seconds)", help: "How long each idle-screen slide is shown." },
  "safety.requireCaffeineAcknowledgement": { label: "Require caffeine acknowledgement", help: "Forces an explicit confirmation before any caffeinated purchase." },
};

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown> | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = () => {
    setError(false);
    adminRequest<Record<string, unknown>>("/settings").then((s) => {
      setSettings(s);
      setDrafts(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, String(v)])));
    }).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !settings) return <ErrorBox message="Could not load settings." onRetry={load} />;
  if (!settings) return <Spinner />;

  const save = async (key: string) => {
    setBusy(key);
    try {
      const raw = drafts[key] ?? "";
      const value: unknown = raw === "true" ? true : raw === "false" ? false : Number.isFinite(Number(raw)) && raw.trim() !== "" ? Number(raw) : raw;
      await adminRequest(`/settings/${key}`, { method: "PUT", body: JSON.stringify({ value }) });
      setSaved(key);
      setTimeout(() => setSaved(null), 2500);
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>System Settings</h1>
      <p style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>Applied on the kiosk's next session start.</p>

      <div className="card" style={{ padding: 8, marginTop: 20 }}>
        {Object.entries(settings).map(([key, value]) => {
          const meta = SETTING_LABELS[key] ?? { label: key, help: "" };
          const isBool = typeof value === "boolean";
          return (
            <div key={key} style={{ display: "flex", gap: 16, alignItems: "center", padding: 16, borderBottom: "1px solid var(--surface-2)", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{meta.label}</div>
                <div style={{ color: "var(--text-3)", fontSize: 12.5, marginTop: 2 }}>{meta.help}</div>
                <div style={{ color: "var(--text-3)", fontSize: 11, fontFamily: "monospace", marginTop: 4 }}>{key}</div>
              </div>
              {isBool ? (
                <select value={drafts[key]} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} style={{ width: 120 }}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              ) : (
                <input value={drafts[key] ?? ""} onChange={(e) => setDrafts({ ...drafts, [key]: e.target.value })} style={{ width: 120 }} />
              )}
              <button className="btn btn-primary btn-sm" disabled={busy === key || drafts[key] === String(value)} onClick={() => save(key)}>
                {saved === key ? "✓ Saved" : "Save"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Audit log (spec §32.13) ──────────────────────────────────────────

interface AuditEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  detail: unknown;
  createdAt: string;
  user: { name: string; role: string } | null;
}

export function AuditPage() {
  const [items, setItems] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState(false);

  const load = () => {
    setError(false);
    adminRequest<AuditEntry[]>("/audit").then(setItems).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !items) return <ErrorBox message="Could not load audit log." onRetry={load} />;
  if (!items) return <Spinner />;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>Audit Log</h1>
      <p style={{ color: "var(--text-3)", fontSize: 13.5, marginTop: 4 }}>
        Every administrative change is recorded — product edits, safety-limit changes, refills, fault simulation, and settings.
      </p>

      <div className="card" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="table">
          <thead><tr><th>When</th><th>User</th><th>Role</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={6} style={{ padding: 24, color: "var(--text-3)" }}>No administrative changes recorded yet.</td></tr>}
            {items.map((a) => (
              <tr key={a.id}>
                <td style={{ whiteSpace: "nowrap", color: "var(--text-2)", fontSize: 12.5 }}>{new Date(a.createdAt).toLocaleString()}</td>
                <td style={{ fontWeight: 700 }}>{a.user?.name ?? "—"}</td>
                <td style={{ color: "var(--text-2)", fontSize: 12.5 }}>{a.user?.role.replace("_", " ").toLowerCase() ?? "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12 }}>{a.action}</td>
                <td style={{ color: "var(--text-2)", fontSize: 12.5 }}>{a.entity}</td>
                <td style={{ fontFamily: "monospace", fontSize: 11.5, color: "var(--text-3)", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {a.detail ? JSON.stringify(a.detail) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
