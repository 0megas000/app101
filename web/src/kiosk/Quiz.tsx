import React, { useState } from "react";
import { useKiosk } from "./KioskApp";
import { kioskApi } from "../api/client";
import { ProductArt, Spinner } from "../design/components";

type Rec = Awaited<ReturnType<typeof kioskApi.quiz>>[number];

const QUESTIONS: { key: string; title: string; options: { value: string; label: string; emoji: string }[] }[] = [
  {
    key: "energy",
    title: "How much energy do you want?",
    options: [
      { value: "LOW", label: "Low & steady", emoji: "🌤" },
      { value: "MEDIUM", label: "Medium", emoji: "⚡" },
      { value: "HIGH", label: "Max energy", emoji: "🔥" },
    ],
  },
  {
    key: "caffeine",
    title: "Do you want caffeine?",
    options: [
      { value: "YES", label: "Yes", emoji: "☕" },
      { value: "NO", label: "No caffeine", emoji: "🌙" },
    ],
  },
  {
    key: "tingle",
    title: "Do you like the tingling sensation?",
    options: [
      { value: "YES", label: "Love it", emoji: "✨" },
      { value: "NO", label: "No thanks", emoji: "🙅" },
      { value: "NOT_SURE", label: "Not sure", emoji: "🤔" },
    ],
  },
  {
    key: "goal",
    title: "What is your primary goal?",
    options: [
      { value: "ENERGY", label: "Energy", emoji: "⚡" },
      { value: "PUMP", label: "Pump", emoji: "💪" },
      { value: "FOCUS", label: "Focus", emoji: "🎯" },
      { value: "PERFORMANCE", label: "Performance", emoji: "🏋️" },
    ],
  },
  {
    key: "experience",
    title: "How experienced are you with pre-workout?",
    options: [
      { value: "NEW", label: "First timer", emoji: "🌱" },
      { value: "SOME", label: "Some experience", emoji: "👍" },
      { value: "EXPERIENCED", label: "Very experienced", emoji: "🏆" },
    ],
  },
];

export function QuizScreen() {
  const { track, openProduct, addToCart, go } = useKiosk();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Rec[] | null>(null);
  const [loading, setLoading] = useState(false);

  const answer = async (value: string) => {
    const q = QUESTIONS[step]!;
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    if (step === 0 && Object.keys(answers).length === 0) track("quiz_started");
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setLoading(true);
      try {
        const recs = await kioskApi.quiz(next);
        setResults(recs);
        track("quiz_completed", { answers: next, topPick: recs[0]?.name });
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) return <Spinner label="Finding your match…" />;

  if (results) {
    return (
      <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 30, fontWeight: 900, marginBottom: 4 }}>Recommended for you</h2>
        <p style={{ color: "var(--ink-2)", marginBottom: 24 }}>Based on your answers — here's why each one fits.</p>
        {results.length === 0 && (
          <div className="card" style={{ padding: 32, color: "var(--ink-2)" }}>
            No strong match — try browsing all products instead.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, textAlign: "left" }}>
          {results.map((r, i) => (
            <div key={r.productId} className="card" style={{ padding: 20, display: "flex", gap: 16, alignItems: "center", borderColor: i === 0 ? "var(--brand)" : undefined, flexWrap: "wrap" }}>
              <ProductArt imageKey={r.imageKey} accentColor={r.accentColor} size={72} />
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontWeight: 900, fontSize: 19 }}>{r.name}</span>
                  {i === 0 && <span className="pill" style={{ background: "rgba(124,92,255,0.2)", color: "var(--brand-2)" }}>Top match</span>}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6 }}>{r.brand} · {r.flavor} · {r.caffeineMgPerScoop} mg caffeine</div>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
                  {r.reasons.map((reason, j) => (
                    <li key={j} style={{ fontSize: 13.5, color: "var(--ink-2)" }}>✓ {reason}</li>
                  ))}
                </ul>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => openProduct(r.productId)}>Details</button>
                <button className="btn btn-primary btn-sm" onClick={() => { addToCart(r.productId); go("cart"); }}>+ Add</button>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => { setResults(null); setStep(0); setAnswers({}); }}>
          Retake quiz
        </button>
      </div>
    );
  }

  const q = QUESTIONS[step]!;
  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: "24px auto", textAlign: "center" }}>
      <div style={{ color: "var(--ink-3)", fontWeight: 700, letterSpacing: "0.1em", fontSize: 13 }}>
        FIND MY PRE · {step + 1} / {QUESTIONS.length}
      </div>
      <h2 style={{ fontSize: 32, fontWeight: 900, margin: "14px 0 30px" }}>{q.title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: q.options.length > 3 ? "1fr 1fr" : "1fr", gap: 14 }}>
        {q.options.map((o) => (
          <button key={o.value} className="card" style={{ padding: 24, fontSize: 20, fontWeight: 800, display: "flex", gap: 14, alignItems: "center", justifyContent: "center", cursor: "pointer" }} onClick={() => answer(o.value)}>
            <span style={{ fontSize: 30 }} aria-hidden>{o.emoji}</span> {o.label}
          </button>
        ))}
      </div>
      {step > 0 && <button className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => setStep(step - 1)}>← Previous question</button>}
    </div>
  );
}
