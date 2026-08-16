import React, { useState } from "react";
import { useKiosk } from "./KioskApp";
import { Modal } from "../design/components";

/** Educational area (spec §20) — topics come from the admin-editable database. */
export function LearnScreen() {
  const { bootstrap } = useKiosk();
  const [open, setOpen] = useState<string | null>(null);
  const topic = bootstrap.education.find((t) => t.slug === open);

  return (
    <div className="fade-in" style={{ maxWidth: 860, margin: "0 auto" }}>
      <h2 style={{ fontSize: 28, fontWeight: 750, marginBottom: 6 }}>New to pre-workout?</h2>
      <p style={{ color: "var(--text-2)", marginBottom: 22 }}>Quick answers to the most common questions. No jargon.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {bootstrap.education.map((t) => (
          <button key={t.id} className="card" style={{ padding: 24, textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }} onClick={() => setOpen(t.slug)}>
            <span style={{ fontSize: 34 }} aria-hidden>{t.emoji}</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{t.title}</span>
            <span style={{ color: "var(--text-3)", fontSize: 13 }}>Tap to read →</span>
          </button>
        ))}
      </div>
      {topic && (
        <Modal onClose={() => setOpen(null)}>
          <div style={{ fontSize: 40, marginBottom: 8 }} aria-hidden>{topic.emoji}</div>
          <h3 style={{ fontSize: 26, fontWeight: 750, letterSpacing: "-0.03em", marginBottom: 12 }}>{topic.title}</h3>
          <p style={{ color: "var(--text-2)", fontSize: 16.5, lineHeight: 1.65 }}>{topic.body}</p>
          <button className="btn btn-primary" style={{ width: "100%", marginTop: 24 }} onClick={() => setOpen(null)}>Got it</button>
        </Modal>
      )}
    </div>
  );
}
