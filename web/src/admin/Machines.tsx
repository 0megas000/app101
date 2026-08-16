import React, { useEffect, useState } from "react";
import { adminRequest } from "../api/client";
import { Spinner, ErrorBox } from "../design/components";

interface Machine {
  id: string;
  serial: string;
  name: string;
  status: string;
  lastHeartbeatAt: string | null;
  lastMaintenanceAt: string | null;
  location: { name: string; gym: { name: string; organization: { name: string } } };
  errors: { id: string; code: string; severity: string; message: string; component: string; resolvedAt: string | null; createdAt: string }[];
  maintenance: { id: string; kind: string; note: string | null; performedBy: string | null; createdAt: string }[];
}

interface Health {
  components: { component: string; ok: boolean; detail: string }[];
  activeFaults: string[];
}

const FAULTS: { key: string; label: string; description: string }[] = [
  { key: "DISPENSER_JAM", label: "Dispenser jam", description: "Auger stalls — dispense fails mid-order" },
  { key: "SENSOR_FAILURE", label: "Sensor failure", description: "Bin level sensors stop reporting" },
  { key: "SCALE_FAILURE", label: "Scale failure", description: "Load cell not responding" },
  { key: "PAYMENT_FAILURE", label: "Payment failure", description: "Terminal declines every charge" },
  { key: "CUP_MISSING", label: "Cup missing", description: "Cup bay reads empty — blocks checkout" },
];

export function MachinesPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    setError(false);
    adminRequest<Machine[]>("/machines").then((m) => {
      setMachines(m);
      setSelected((prev) => prev ?? m[0]?.id ?? null);
    }).catch(() => setError(true));
  };
  useEffect(load, []);

  const loadHealth = (id: string) => {
    adminRequest<Health>(`/machines/${id}/health`).then(setHealth).catch(() => setHealth(null));
  };
  useEffect(() => { if (selected) loadHealth(selected); }, [selected]);

  if (error && !machines) return <ErrorBox message="Could not load machines." onRetry={load} />;
  if (!machines) return <Spinner />;

  const machine = machines.find((m) => m.id === selected) ?? machines[0];
  if (!machine) return <div className="card" style={{ padding: 24 }}>No machines configured.</div>;

  const toggleFault = async (fault: string, active: boolean) => {
    setBusy(true);
    try {
      const res = await adminRequest<{ activeFaults: string[] }>(`/machines/${machine.id}/faults`, {
        method: "POST",
        body: JSON.stringify({ fault, active }),
      });
      setHealth((h) => (h ? { ...h, activeFaults: res.activeFaults } : h));
      loadHealth(machine.id);
    } finally { setBusy(false); }
  };

  const runTest = async (kind: string) => {
    setBusy(true); setTestResult(null);
    try {
      const res = await adminRequest<{ ok: boolean; message: string }>(`/machines/${machine.id}/test/${kind}`, { method: "POST" });
      setTestResult(res);
      load();
    } finally { setBusy(false); }
  };

  const resolveError = async (errorId: string) => {
    await adminRequest(`/machines/${machine.id}/errors/${errorId}/resolve`, { method: "POST" });
    load();
  };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em" }}>Machine Status & Maintenance</h1>

      <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
        {machines.map((m) => (
          <button key={m.id} className={`chip ${m.id === machine.id ? "active" : ""}`} style={{ minHeight: 40, fontSize: 13.5 }} onClick={() => { setSelected(m.id); setTestResult(null); }}>
            {m.status === "ONLINE" ? "🟢" : m.status === "ERROR" ? "🔴" : "⚪"} {m.serial}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 750 }}>{machine.name}</div>
            <div style={{ color: "var(--text-2)", fontSize: 13.5 }}>
              {machine.location.gym.organization.name} › {machine.location.gym.name} › {machine.location.name}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 13, color: "var(--text-2)" }}>
            <div>Status: <b style={{ color: machine.status === "ONLINE" ? "var(--good-fg)" : "var(--text-3)" }}>{machine.status}</b></div>
            <div>Last heartbeat: {machine.lastHeartbeatAt ? new Date(machine.lastHeartbeatAt).toLocaleString() : "never"}</div>
            <div>Last maintenance: {machine.lastMaintenanceAt ? new Date(machine.lastMaintenanceAt).toLocaleDateString() : "—"}</div>
          </div>
        </div>
      </div>

      <h2 className="section-title">Component health</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {(health?.components ?? []).map((c) => (
          <div key={c.component} className="card" style={{ padding: 16, borderColor: c.ok ? undefined : "var(--danger-fg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, textTransform: "capitalize" }}>
              <span aria-hidden>{c.ok ? "🟢" : "🔴"}</span> {c.component.replace("-", " ")}
              <span style={{ marginLeft: "auto", fontSize: 11.5, color: c.ok ? "var(--good-fg)" : "var(--danger-fg)", fontWeight: 700 }}>{c.ok ? "OK" : "FAULT"}</span>
            </div>
            <div style={{ color: "var(--text-2)", fontSize: 12.5, marginTop: 4 }}>{c.detail}</div>
          </div>
        ))}
        {!health && <Spinner label="Reading hardware…" />}
      </div>

      <h2 className="section-title">Maintenance tools</h2>
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => runTest("dispenser")}>Run dispenser test</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => runTest("scale")}>Calibrate scale</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => runTest("sensor")}>Test sensor</button>
          <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => runTest("payment")}>Test payment system</button>
        </div>
        {testResult && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 10, background: testResult.ok ? "var(--good-soft)" : "var(--danger-soft)", border: `1px solid ${testResult.ok ? "var(--good)" : "var(--danger-border)"}`, fontSize: 13.5 }}>
            {testResult.ok ? "✅" : "❌"} {testResult.message}
          </div>
        )}
      </div>

      <h2 className="section-title">Simulate hardware failure</h2>
      <div className="card" style={{ padding: 20 }}>
        <p style={{ color: "var(--text-3)", fontSize: 13, marginBottom: 14 }}>
          Toggle a fault, then run a kiosk transaction to see how the customer experience degrades. Faults apply to the simulated hardware adapters only.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {FAULTS.map((f) => {
            const active = health?.activeFaults.includes(f.key) ?? false;
            return (
              <div key={f.key} className="card" style={{ padding: 14, background: "var(--surface-2)", borderColor: active ? "var(--warn-fg)" : "var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{f.label}</div>
                    <div style={{ color: "var(--text-3)", fontSize: 12 }}>{f.description}</div>
                  </div>
                  <button className={`btn btn-sm ${active ? "btn-danger" : "btn-ghost"}`} disabled={busy} onClick={() => toggleFault(f.key, !active)}>
                    {active ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <h2 className="section-title">Error log</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>When</th><th>Severity</th><th>Component</th><th>Message</th><th>Status</th><th /></tr></thead>
          <tbody>
            {machine.errors.length === 0 && <tr><td colSpan={6} style={{ color: "var(--text-3)", padding: 20 }}>No errors recorded.</td></tr>}
            {machine.errors.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap", color: "var(--text-2)", fontSize: 12.5 }}>{new Date(e.createdAt).toLocaleString()}</td>
                <td style={{ color: e.severity === "CRITICAL" ? "var(--danger-fg)" : e.severity === "ERROR" ? "var(--serious-fg)" : "var(--warn-fg)", fontWeight: 700, fontSize: 12.5 }}>{e.severity}</td>
                <td style={{ color: "var(--text-2)" }}>{e.component}</td>
                <td>{e.message}</td>
                <td>{e.resolvedAt ? <span style={{ color: "var(--good-fg)" }}>Resolved</span> : <span style={{ color: "var(--warn-fg)" }}>Open</span>}</td>
                <td>{!e.resolvedAt && <button className="btn btn-ghost btn-sm" onClick={() => resolveError(e.id)}>Resolve</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">Maintenance history</h2>
      <div className="card" style={{ overflowX: "auto" }}>
        <table className="table">
          <thead><tr><th>When</th><th>Type</th><th>Note</th><th>By</th></tr></thead>
          <tbody>
            {machine.maintenance.length === 0 && <tr><td colSpan={4} style={{ color: "var(--text-3)", padding: 20 }}>No maintenance recorded.</td></tr>}
            {machine.maintenance.map((m) => (
              <tr key={m.id}>
                <td style={{ whiteSpace: "nowrap", color: "var(--text-2)", fontSize: 12.5 }}>{new Date(m.createdAt).toLocaleString()}</td>
                <td style={{ fontWeight: 700 }}>{m.kind.replace(/_/g, " ").toLowerCase()}</td>
                <td style={{ color: "var(--text-2)" }}>{m.note ?? "—"}</td>
                <td style={{ color: "var(--text-2)" }}>{m.performedBy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
