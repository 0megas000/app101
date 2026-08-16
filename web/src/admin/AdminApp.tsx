import React, { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { adminRequest, setAdminToken, ApiError } from "../api/client";
import { ThemeToggle } from "../design/theme";
import { OverviewPage } from "./Overview";
import { SalesAnalyticsPage, ProductAnalyticsPage, InteractionAnalyticsPage } from "./Analytics";
import { InventoryPage } from "./Inventory";
import { ProductsPage, IngredientsPage, WarningsPage, LimitsPage } from "./Catalog";
import { MachinesPage } from "./Machines";
import { PromotionsPage, SettingsPage, AuditPage } from "./System";

interface Me { userId: string; name: string; role: string }

export function AdminApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    adminRequest<Me>("/me")
      .then(setMe)
      .catch(() => setAdminToken(null))
      .finally(() => setChecked(true));
  }, []);

  if (!checked) return null;
  if (!me) return <LoginScreen onLogin={setMe} />;
  return <AdminShell me={me} onLogout={() => { void adminRequest("/auth/logout", { method: "POST" }).catch(() => {}); setAdminToken(null); setMe(null); }} />;
}

function LoginScreen({ onLogin }: { onLogin: (me: Me) => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const session = await adminRequest<{ token: string; name: string; role: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      setAdminToken(session.token);
      onLogin({ userId: "", name: session.name, role: session.role });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <form className="card" style={{ padding: 40, width: 360, textAlign: "center" }} onSubmit={submit}>
        <div style={{ fontSize: 36 }} aria-hidden>🔐</div>
        <h1 style={{ fontSize: 22, fontWeight: 750, margin: "10px 0 4px" }}>Admin access</h1>
        <p style={{ color: "var(--text-3)", fontSize: 13, marginBottom: 20 }}>Enter your operator PIN</p>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ width: "100%", textAlign: "center", fontSize: 24, letterSpacing: "0.4em", padding: 14 }}
          placeholder="••••"
        />
        {error && <div style={{ color: "var(--danger-fg)", fontSize: 13.5, marginTop: 10 }}>{error}</div>}
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={busy || pin.length < 4}>
          {busy ? "Checking…" : "Sign in"}
        </button>
        <div style={{ color: "var(--text-3)", fontSize: 12, marginTop: 16 }}>Demo PINs: 1234 (super admin) · 3456 (gym manager) · 4567 (technician)</div>
      </form>
    </div>
  );
}

const NAV: { to: string; icon: string; label: string }[] = [
  { to: "/admin", icon: "📊", label: "Overview" },
  { to: "/admin/sales", icon: "💰", label: "Sales Analytics" },
  { to: "/admin/products-analytics", icon: "📈", label: "Product Analytics" },
  { to: "/admin/interactions", icon: "🧭", label: "Interactions" },
  { to: "/admin/inventory", icon: "📦", label: "Inventory" },
  { to: "/admin/products", icon: "🥤", label: "Products" },
  { to: "/admin/ingredients", icon: "🧪", label: "Ingredients" },
  { to: "/admin/warnings", icon: "⚠️", label: "Warnings" },
  { to: "/admin/limits", icon: "🛡", label: "Safety Rules" },
  { to: "/admin/machines", icon: "🤖", label: "Machines" },
  { to: "/admin/promotions", icon: "📣", label: "Promotions" },
  { to: "/admin/settings", icon: "⚙️", label: "Settings" },
  { to: "/admin/audit", icon: "📜", label: "Audit Log" },
];

function AdminShell({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [alerts, setAlerts] = useState<{ id: number; severity: string; message: string }[]>([]);

  // Live alerts over WebSocket (inventory, faults, orders)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`);
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; severity?: string; message?: string };
          if (msg.type === "alert" && msg.message) {
            const id = Date.now() + Math.random();
            setAlerts((prev) => [...prev.slice(-3), { id, severity: msg.severity ?? "info", message: msg.message! }]);
            setTimeout(() => setAlerts((prev) => prev.filter((a) => a.id !== id)), 8000);
          }
        } catch { /* ignore malformed frames */ }
      };
      ws.onclose = () => { if (!closed) setTimeout(connect, 3000); };
    };
    connect();
    return () => { closed = true; ws?.close(); };
  }, []);

  return (
    <div className="admin">
      <nav className="admin-nav">
        <div style={{ padding: "6px 14px 18px", fontWeight: 750, letterSpacing: "0.06em", fontSize: 15 }}>
          ⚡ <span>PULSEFUEL</span>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === "/admin"} className={({ isActive }) => (isActive ? "active" : "")}>
            {n.icon} <span>{n.label}</span>
          </NavLink>
        ))}
        <div style={{ marginTop: "auto", padding: "14px 12px 4px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <ThemeToggle />
          </div>
          <div className="nav-footer-text" style={{ fontSize: 13, fontWeight: 650 }}>{me.name}</div>
          <div className="nav-footer-text" style={{ fontSize: 11.5, color: "var(--text-3)", marginBottom: 8, textTransform: "capitalize" }}>
            {me.role.replace(/_/g, " ").toLowerCase()}
          </div>
          <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} onClick={onLogout} title="Sign out">⎋ <span className="nav-footer-text">Sign out</span></button>
        </div>
      </nav>

      <main className="admin-main">
        <Routes>
          <Route index element={<OverviewPage />} />
          <Route path="sales" element={<SalesAnalyticsPage />} />
          <Route path="products-analytics" element={<ProductAnalyticsPage />} />
          <Route path="interactions" element={<InteractionAnalyticsPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="ingredients" element={<IngredientsPage />} />
          <Route path="warnings" element={<WarningsPage />} />
          <Route path="limits" element={<LimitsPage />} />
          <Route path="machines" element={<MachinesPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </main>

      {/* Toast alerts */}
      <div style={{ position: "fixed", right: 20, bottom: 20, display: "flex", flexDirection: "column", gap: 10, zIndex: 100 }}>
        {alerts.map((a) => (
          <div key={a.id} className="card fade-in" style={{ padding: "12px 18px", borderColor: a.severity === "error" ? "var(--danger-fg)" : a.severity === "warning" ? "var(--warn-fg)" : "var(--border)", maxWidth: 380, fontSize: 13.5 }}>
            {a.severity === "error" ? "🔴" : a.severity === "warning" ? "🟡" : "🔵"} {a.message}
          </div>
        ))}
      </div>
    </div>
  );
}
