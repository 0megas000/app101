import React, { useEffect, useState } from "react";
import { adminRequest, formatCents } from "../api/client";
import { StatTile, Spinner, ErrorBox } from "../design/components";

interface Overview {
  todaySalesCents: number;
  todayTransactions: number;
  weekSalesCents: number;
  monthSalesCents: number;
  monthTransactions: number;
  averageTransactionCents: number;
  mostPopular: { name: string; brand: string; purchases: number } | null;
  lowestInventory: { name: string; percent: number; binNumber: number } | null;
  openErrors: number;
  machines: { id: string; serial: string; name: string; status: string; gym: string }[];
}

export function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const load = () => adminRequest<Overview>("/overview").then(setData).catch(() => setError(true));
  useEffect(() => { void load(); }, []);

  if (error) return <ErrorBox message="Could not load overview." onRetry={() => { setError(false); void load(); }} />;
  if (!data) return <Spinner />;

  const statusStyle: Record<string, string> = { ONLINE: "var(--good)", OFFLINE: "var(--ink-3)", MAINTENANCE: "var(--warn)", ERROR: "var(--bad)" };

  return (
    <div className="fade-in">
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 20 }}>Overview</h1>
      <div className="stat-grid">
        <StatTile label="Today's Sales" value={formatCents(data.todaySalesCents)} sub={`${data.todayTransactions} transactions`} />
        <StatTile label="Weekly Sales" value={formatCents(data.weekSalesCents)} />
        <StatTile label="Monthly Sales" value={formatCents(data.monthSalesCents)} sub={`${data.monthTransactions} transactions`} />
        <StatTile label="Avg Transaction" value={formatCents(data.averageTransactionCents)} />
        <StatTile label="Most Popular" value={data.mostPopular?.name ?? "—"} sub={data.mostPopular ? `${data.mostPopular.brand} · ${data.mostPopular.purchases} purchases (30d)` : undefined} />
        <StatTile label="Lowest Inventory" value={data.lowestInventory ? `${data.lowestInventory.percent}%` : "—"} sub={data.lowestInventory ? `${data.lowestInventory.name} (bin ${data.lowestInventory.binNumber})` : undefined} />
        <StatTile label="Open Errors" value={String(data.openErrors)} sub={data.openErrors > 0 ? "See Machines → error log" : "All clear"} />
      </div>

      <h2 className="section-title">Fleet</h2>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr><th>Machine</th><th>Gym</th><th>Serial</th><th>Status</th></tr>
          </thead>
          <tbody>
            {data.machines.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 700 }}>{m.name}</td>
                <td>{m.gym}</td>
                <td style={{ color: "var(--ink-2)" }}>{m.serial}</td>
                <td>
                  <span style={{ color: statusStyle[m.status] ?? "var(--ink-2)", fontWeight: 700 }}>
                    {m.status === "ONLINE" ? "🟢" : m.status === "ERROR" ? "🔴" : m.status === "MAINTENANCE" ? "🟡" : "⚪"} {m.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
