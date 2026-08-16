import React, { useEffect, useState } from "react";
import { adminRequest, formatCents, ApiError } from "../api/client";
import { Modal, SeverityPill, Spinner, ErrorBox } from "../design/components";

// ── Products (spec §17) ──────────────────────────────────────────────

interface AdminProduct {
  id: string;
  name: string;
  flavor: string;
  brand: { id: string; name: string };
  description: string;
  pricePerScoopCents: number;
  servingSizeGrams: number;
  maxScoopsPerServing: number;
  caffeineMgPerScoop: number;
  isStimulant: boolean;
  energyRating: number;
  pumpRating: number;
  tingleRating: number;
  focusRating: number;
  strength: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  featured: boolean;
  staffPick: boolean;
  active: boolean;
  ingredients: { ingredientId: string; amountPerScoop: number; major: boolean; ingredient: { name: string; unit: string } }[];
  tags: { tag: { slug: string; label: string } }[];
}

export function ProductsPage() {
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);

  const load = () => {
    setError(false);
    adminRequest<AdminProduct[]>("/products").then(setProducts).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !products) return <ErrorBox message="Could not load products." onRetry={load} />;
  if (!products) return <Spinner />;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Product Management</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 4 }}>
        Adding or changing a product never requires a code change — the kiosk reads everything from here.
      </p>

      <div className="card" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr><th>Product</th><th>Brand</th><th>Flavor</th><th>Price</th><th>Caffeine</th><th>Strength</th><th>Tags</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 700 }}>{p.name}</td>
                <td style={{ color: "var(--ink-2)" }}>{p.brand.name}</td>
                <td style={{ color: "var(--ink-2)" }}>{p.flavor}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatCents(p.pricePerScoopCents)}</td>
                <td style={{ fontVariantNumeric: "tabular-nums" }}>{p.caffeineMgPerScoop} mg</td>
                <td>{p.strength.toLowerCase()}</td>
                <td style={{ fontSize: 12, color: "var(--ink-3)", maxWidth: 220 }}>{p.tags.map((t) => t.tag.label).join(", ")}</td>
                <td>{p.active ? <span style={{ color: "var(--good)" }}>● Active</span> : <span style={{ color: "var(--ink-3)" }}>○ Hidden</span>}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(p)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <ProductEditor product={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function ProductEditor({ product, onClose, onSaved }: { product: AdminProduct; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product.name,
    flavor: product.flavor,
    description: product.description,
    pricePerScoopCents: product.pricePerScoopCents,
    servingSizeGrams: product.servingSizeGrams,
    maxScoopsPerServing: product.maxScoopsPerServing,
    energyRating: product.energyRating,
    pumpRating: product.pumpRating,
    tingleRating: product.tingleRating,
    focusRating: product.focusRating,
    strength: product.strength,
    featured: product.featured,
    staffPick: product.staffPick,
    active: product.active,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      await adminRequest(`/products/${product.id}`, { method: "PUT", body: JSON.stringify(form) });
      onSaved();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Save failed");
    } finally { setBusy(false); }
  };

  const num = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: Number(e.target.value) });
  const str = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value });
  const bool = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.checked });

  return (
    <Modal onClose={onClose} wide>
      <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>Edit product</h3>
      <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 20 }}>{product.brand.name} · changes are written to the audit log</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label="Name"><input value={form.name} onChange={str("name")} style={{ width: "100%" }} /></Field>
        <Field label="Flavor"><input value={form.flavor} onChange={str("flavor")} style={{ width: "100%" }} /></Field>
        <Field label="Price per scoop (cents)"><input type="number" value={form.pricePerScoopCents} onChange={num("pricePerScoopCents")} style={{ width: "100%" }} /></Field>
        <Field label="Serving size (g)"><input type="number" step="0.5" value={form.servingSizeGrams} onChange={num("servingSizeGrams")} style={{ width: "100%" }} /></Field>
        <Field label="Max scoops per serving"><input type="number" min={1} max={4} value={form.maxScoopsPerServing} onChange={num("maxScoopsPerServing")} style={{ width: "100%" }} /></Field>
        <Field label="Strength">
          <select value={form.strength} onChange={str("strength")} style={{ width: "100%" }}>
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
          </select>
        </Field>
        <Field label="Energy rating (0-5)"><input type="number" min={0} max={5} value={form.energyRating} onChange={num("energyRating")} style={{ width: "100%" }} /></Field>
        <Field label="Pump rating (0-5)"><input type="number" min={0} max={5} value={form.pumpRating} onChange={num("pumpRating")} style={{ width: "100%" }} /></Field>
        <Field label="Tingle rating (0-5)"><input type="number" min={0} max={5} value={form.tingleRating} onChange={num("tingleRating")} style={{ width: "100%" }} /></Field>
        <Field label="Focus rating (0-5)"><input type="number" min={0} max={5} value={form.focusRating} onChange={num("focusRating")} style={{ width: "100%" }} /></Field>
      </div>

      <Field label="Description">
        <textarea value={form.description} onChange={str("description")} rows={3} style={{ width: "100%", resize: "vertical" }} />
      </Field>

      <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
        <Check label="Active (visible on kiosk)" checked={form.active} onChange={bool("active")} />
        <Check label="Featured" checked={form.featured} onChange={bool("featured")} />
        <Check label="Staff pick" checked={form.staffPick} onChange={bool("staffPick")} />
      </div>

      <div style={{ marginTop: 18, padding: 14, background: "var(--bg-2)", borderRadius: 12, fontSize: 13, color: "var(--ink-2)" }}>
        <b>Ingredients</b> (per scoop): {product.ingredients.map((i) => `${i.ingredient.name} ${i.amountPerScoop} ${i.ingredient.unit}`).join(" · ")}
      </div>

      {err && <div style={{ color: "var(--bad)", marginTop: 12 }}>{err}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginTop: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      {children}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 18, height: 18 }} />
      {label}
    </label>
  );
}

// ── Ingredients (spec §18) ───────────────────────────────────────────

interface AdminIngredient {
  id: string;
  name: string;
  category: string;
  unit: string;
  plainExplanation: string;
  sensation: string;
  technicalExplanation: string;
  warningInfo: string | null;
  typicalDoseMin: number;
  typicalDoseMax: number;
  tracked: boolean;
  limits: { id: string; maxPerTransaction: number }[];
}

export function IngredientsPage() {
  const [items, setItems] = useState<AdminIngredient[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<AdminIngredient | null>(null);

  const load = () => {
    setError(false);
    adminRequest<AdminIngredient[]>("/ingredients").then(setItems).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !items) return <ErrorBox message="Could not load ingredients." onRetry={load} />;
  if (!items) return <Spinner />;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Ingredient Database</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 4 }}>
        Powers the [?] education tooltips on the kiosk. Plain language first; keep claims conservative and non-medical.
      </p>

      <div className="card" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr><th>Ingredient</th><th>Category</th><th>Typical dose</th><th>Limited</th><th>Plain explanation</th><th /></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <td style={{ fontWeight: 700 }}>{i.name}</td>
                <td style={{ color: "var(--ink-2)", fontSize: 12.5 }}>{i.category.replace("_", " ").toLowerCase()}</td>
                <td style={{ whiteSpace: "nowrap" }}>{i.typicalDoseMin}–{i.typicalDoseMax} {i.unit}</td>
                <td>{i.tracked ? <span style={{ color: "var(--warn)" }}>🛡 Tracked</span> : <span style={{ color: "var(--ink-3)" }}>—</span>}</td>
                <td style={{ color: "var(--ink-2)", fontSize: 12.5, maxWidth: 380 }}>{i.plainExplanation.slice(0, 110)}…</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(i)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <IngredientEditor ingredient={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function IngredientEditor({ ingredient, onClose, onSaved }: { ingredient: AdminIngredient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    plainExplanation: ingredient.plainExplanation,
    sensation: ingredient.sensation,
    technicalExplanation: ingredient.technicalExplanation,
    warningInfo: ingredient.warningInfo ?? "",
    typicalDoseMin: ingredient.typicalDoseMin,
    typicalDoseMax: ingredient.typicalDoseMax,
    tracked: ingredient.tracked,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminRequest(`/ingredients/${ingredient.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...form, warningInfo: form.warningInfo || null }),
      });
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} wide>
      <h3 style={{ fontSize: 22, fontWeight: 900 }}>{ingredient.name}</h3>
      <div style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 12 }}>{ingredient.category.replace("_", " ").toLowerCase()} · {ingredient.unit}</div>
      <Field label="What does it do? (plain language)">
        <textarea value={form.plainExplanation} onChange={(e) => setForm({ ...form, plainExplanation: e.target.value })} rows={3} style={{ width: "100%" }} />
      </Field>
      <Field label="What might you feel?">
        <textarea value={form.sensation} onChange={(e) => setForm({ ...form, sensation: e.target.value })} rows={2} style={{ width: "100%" }} />
      </Field>
      <Field label="Learn more (technical)">
        <textarea value={form.technicalExplanation} onChange={(e) => setForm({ ...form, technicalExplanation: e.target.value })} rows={3} style={{ width: "100%" }} />
      </Field>
      <Field label="Good to know / warning info">
        <textarea value={form.warningInfo} onChange={(e) => setForm({ ...form, warningInfo: e.target.value })} rows={2} style={{ width: "100%" }} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Field label={`Typical dose min (${ingredient.unit})`}>
          <input type="number" step="0.05" value={form.typicalDoseMin} onChange={(e) => setForm({ ...form, typicalDoseMin: Number(e.target.value) })} style={{ width: "100%" }} />
        </Field>
        <Field label={`Typical dose max (${ingredient.unit})`}>
          <input type="number" step="0.05" value={form.typicalDoseMax} onChange={(e) => setForm({ ...form, typicalDoseMax: Number(e.target.value) })} style={{ width: "100%" }} />
        </Field>
      </div>
      <div style={{ marginTop: 14 }}>
        <Check label="Tracked by the safety limit engine" checked={form.tracked} onChange={(e) => setForm({ ...form, tracked: e.target.checked })} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── Warnings (spec §9) ───────────────────────────────────────────────

interface AdminWarning {
  id: string;
  code: string;
  severity: "INFO" | "CAUTION" | "IMPORTANT" | "BLOCKING";
  title: string;
  body: string;
  requiresAcknowledgement: boolean;
  active: boolean;
  products: { product: { name: string } }[];
}

export function WarningsPage() {
  const [items, setItems] = useState<AdminWarning[] | null>(null);
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<AdminWarning | null>(null);

  const load = () => {
    setError(false);
    adminRequest<AdminWarning[]>("/warnings").then(setItems).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !items) return <ErrorBox message="Could not load warnings." onRetry={load} />;
  if (!items) return <Spinner />;

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Warning Management</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 4 }}>
        Warnings merge automatically when products are mixed. IMPORTANT and acknowledgement-flagged warnings must be confirmed before payment; BLOCKING warnings stop the sale.
      </p>

      <div className="card" style={{ overflowX: "auto", marginTop: 20 }}>
        <table className="table">
          <thead>
            <tr><th>Severity</th><th>Code</th><th>Title</th><th>Ack required</th><th>Products</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {items.map((w) => (
              <tr key={w.id}>
                <td><SeverityPill severity={w.severity} /></td>
                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ink-2)" }}>{w.code}</td>
                <td style={{ fontWeight: 700 }}>{w.title}</td>
                <td>{w.requiresAcknowledgement ? "✓ Yes" : "—"}</td>
                <td style={{ color: "var(--ink-3)", fontSize: 12.5 }}>{w.products.length}</td>
                <td>{w.active ? <span style={{ color: "var(--good)" }}>● Active</span> : <span style={{ color: "var(--ink-3)" }}>○ Off</span>}</td>
                <td><button className="btn btn-ghost btn-sm" onClick={() => setEditing(w)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && <WarningEditor warning={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </div>
  );
}

function WarningEditor({ warning, onClose, onSaved }: { warning: AdminWarning; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title: warning.title,
    body: warning.body,
    severity: warning.severity,
    requiresAcknowledgement: warning.requiresAcknowledgement,
    active: warning.active,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await adminRequest(`/warnings/${warning.id}`, { method: "PUT", body: JSON.stringify(form) });
      onSaved();
    } finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose}>
      <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>Edit warning</h3>
      <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: "100%" }} /></Field>
      <Field label="Body"><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} style={{ width: "100%" }} /></Field>
      <Field label="Severity">
        <select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value as AdminWarning["severity"] })} style={{ width: "100%" }}>
          <option value="INFO">INFO — shown for context</option>
          <option value="CAUTION">CAUTION — shown prominently</option>
          <option value="IMPORTANT">IMPORTANT — must be acknowledged</option>
          <option value="BLOCKING">BLOCKING — prevents the transaction</option>
        </select>
      </Field>
      <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
        <Check label="Require explicit acknowledgement" checked={form.requiresAcknowledgement} onChange={(e) => setForm({ ...form, requiresAcknowledgement: e.target.checked })} />
        <Check label="Active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
        <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</button>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      </div>
    </Modal>
  );
}

// ── Safety limits & combination rules (spec §7, §26) ─────────────────

interface LimitsData {
  limits: { id: string; maxPerTransaction: number; active: boolean; note: string | null; ingredient: { name: string; unit: string } }[];
  rules: { id: string; type: string; name: string; config: Record<string, unknown>; active: boolean }[];
}

export function LimitsPage() {
  const [data, setData] = useState<LimitsData | null>(null);
  const [error, setError] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    setError(false);
    adminRequest<LimitsData>("/limits").then((d) => {
      setData(d);
      setDrafts(Object.fromEntries(d.limits.map((l) => [l.id, l.maxPerTransaction])));
    }).catch(() => setError(true));
  };
  useEffect(load, []);

  if (error && !data) return <ErrorBox message="Could not load safety rules." onRetry={load} />;
  if (!data) return <Spinner />;

  const saveLimit = async (id: string) => {
    setBusy(id);
    try {
      await adminRequest(`/limits/${id}`, { method: "PUT", body: JSON.stringify({ maxPerTransaction: drafts[id] }) });
      load();
    } finally { setBusy(null); }
  };

  const toggleLimit = async (id: string, active: boolean) => {
    setBusy(id);
    try {
      await adminRequest(`/limits/${id}`, { method: "PUT", body: JSON.stringify({ active }) });
      load();
    } finally { setBusy(null); }
  };

  const toggleRule = async (id: string, active: boolean) => {
    setBusy(id);
    try {
      await adminRequest(`/rules/${id}`, { method: "PUT", body: JSON.stringify({ active }) });
      load();
    } finally { setBusy(null); }
  };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Safety Rules & Ingredient Limits</h1>
      <p style={{ color: "var(--ink-3)", fontSize: 13.5, marginTop: 4, maxWidth: 760 }}>
        These values are enforced server-side on every quote and every checkout. Nothing here is hard-coded — set them to match
        your manufacturer guidance and local regulatory requirements. Operators are responsible for the values chosen.
      </p>

      <h2 className="section-title">Per-transaction ingredient limits</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Ingredient</th><th>Max per transaction</th><th>Note</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {data.limits.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 700 }}>{l.ingredient.name}</td>
                <td>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="number" step="0.1"
                      value={drafts[l.id] ?? l.maxPerTransaction}
                      onChange={(e) => setDrafts({ ...drafts, [l.id]: Number(e.target.value) })}
                      style={{ width: 110 }}
                    />
                    <span style={{ color: "var(--ink-3)" }}>{l.ingredient.unit}</span>
                  </div>
                </td>
                <td style={{ color: "var(--ink-2)", fontSize: 12.5, maxWidth: 320 }}>{l.note ?? "—"}</td>
                <td>{l.active ? <span style={{ color: "var(--good)" }}>● Enforced</span> : <span style={{ color: "var(--bad)" }}>○ Disabled</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="btn btn-primary btn-sm" disabled={busy === l.id || drafts[l.id] === l.maxPerTransaction} onClick={() => saveLimit(l.id)}>Save</button>{" "}
                  <button className="btn btn-ghost btn-sm" disabled={busy === l.id} onClick={() => toggleLimit(l.id, !l.active)}>{l.active ? "Disable" : "Enable"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Combination rules</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>Rule</th><th>Type</th><th>Configuration</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {data.rules.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 700 }}>{r.name}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ink-2)" }}>{r.type}</td>
                <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--ink-2)", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }}>{JSON.stringify(r.config)}</td>
                <td>{r.active ? <span style={{ color: "var(--good)" }}>● Enforced</span> : <span style={{ color: "var(--bad)" }}>○ Disabled</span>}</td>
                <td><button className="btn btn-ghost btn-sm" disabled={busy === r.id} onClick={() => toggleRule(r.id, !r.active)}>{r.active ? "Disable" : "Enable"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
