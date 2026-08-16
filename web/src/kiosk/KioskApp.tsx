import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { kioskApi, type Bootstrap, type ProductCard, type Quote } from "../api/client";
import { ProductArt, Spinner, ErrorBox } from "../design/components";
import { ThemeToggle } from "../design/theme";
import { BrowseScreen } from "./Browse";
import { DetailScreen } from "./Detail";
import { CompareScreen } from "./Compare";
import { CartFlow } from "./CartFlow";
import { QuizScreen } from "./Quiz";
import { LearnScreen } from "./Learn";

export type KioskScreen =
  | "attract" | "browse" | "detail" | "compare"
  | "cart" | "warnings" | "summary" | "dispensing" | "complete"
  | "quiz" | "learn";

export interface CartItem { productId: string; scoops: number }

interface KioskState {
  bootstrap: Bootstrap;
  products: ProductCard[];
  screen: KioskScreen;
  go: (screen: KioskScreen) => void;
  sessionId: string | undefined;
  track: (type: string, payload?: Record<string, unknown>) => void;
  selectedProductId: string | null;
  openProduct: (id: string) => void;
  compareIds: string[];
  setCompareIds: (ids: string[]) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (productId: string) => void;
  quote: Quote | null;
  quoteLoading: boolean;
  acknowledged: Set<string>;
  setAcknowledged: React.Dispatch<React.SetStateAction<Set<string>>>;
  orderId: string | null;
  setOrderId: (id: string | null) => void;
  resetToAttract: (reason?: string) => void;
  refreshProducts: () => void;
}

const KioskContext = createContext<KioskState | null>(null);
export function useKiosk(): KioskState {
  const ctx = useContext(KioskContext);
  if (!ctx) throw new Error("useKiosk outside provider");
  return ctx;
}

export function KioskApp() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [products, setProducts] = useState<ProductCard[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoadError(null);
    Promise.all([kioskApi.bootstrap(), kioskApi.products()])
      .then(([b, p]) => { setBootstrap(b); setProducts(p); })
      .catch(() => setLoadError("Cannot reach the machine controller."));
  }, []);
  useEffect(load, [load]);

  if (loadError) return <div className="kiosk" style={{ justifyContent: "center", padding: 48 }}><ErrorBox message={loadError} onRetry={load} /></div>;
  if (!bootstrap || !products) return <div className="kiosk" style={{ justifyContent: "center" }}><Spinner label="Starting up…" /></div>;
  return <KioskShell bootstrap={bootstrap} initialProducts={products} />;
}

function KioskShell({ bootstrap, initialProducts }: { bootstrap: Bootstrap; initialProducts: ProductCard[] }) {
  const [screen, setScreen] = useState<KioskScreen>("attract");
  const [products, setProducts] = useState(initialProducts);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [orderId, setOrderId] = useState<string | null>(null);

  const sessionRef = useRef<string | undefined>(undefined);
  sessionRef.current = sessionId;

  const track = useCallback((type: string, payload?: Record<string, unknown>) => {
    kioskApi.event(sessionRef.current, type, payload);
  }, []);

  const refreshProducts = useCallback(() => {
    kioskApi.products().then(setProducts).catch(() => {});
  }, []);

  const resetToAttract = useCallback((reason?: string) => {
    if (reason && sessionRef.current) kioskApi.event(sessionRef.current, reason);
    setScreen("attract");
    setCart([]);
    setQuote(null);
    setAcknowledged(new Set());
    setOrderId(null);
    setCompareIds([]);
    setSelectedProductId(null);
    setSessionId(undefined);
    refreshProducts();
  }, [refreshProducts]);

  // ── Idle timeout (configurable, spec §10) ──────────────────────────
  const idleSeconds = Number(bootstrap.settings["kiosk.idleTimeoutSeconds"] ?? 60);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const armIdle = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      // Never interrupt an active dispense; re-arm instead
      if (screenRef.current === "dispensing") armIdle();
      else if (screenRef.current !== "attract") resetToAttract("session_timeout");
    }, idleSeconds * 1000);
  }, [idleSeconds, resetToAttract]);

  useEffect(() => {
    const onInteract = () => { if (screenRef.current !== "attract") armIdle(); };
    window.addEventListener("pointerdown", onInteract);
    return () => window.removeEventListener("pointerdown", onInteract);
  }, [armIdle]);

  const go = useCallback((next: KioskScreen) => { setScreen(next); armIdle(); }, [armIdle]);

  const openProduct = useCallback((id: string) => {
    setSelectedProductId(id);
    const p = products.find((x) => x.id === id);
    kioskApi.event(sessionRef.current, "product_viewed", { productId: id, name: p?.name });
    go("detail");
  }, [products, go]);

  const addToCart = useCallback((productId: string) => {
    setCart((prev) => {
      if (prev.some((i) => i.productId === productId)) return prev;
      return [...prev, { productId, scoops: 1 }];
    });
    kioskApi.event(sessionRef.current, "added_to_mix", { productId });
  }, []);

  // Live server-side quote whenever the cart changes (spec §32.5/6)
  useEffect(() => {
    if (cart.length === 0) { setQuote(null); return; }
    let cancelled = false;
    setQuoteLoading(true);
    kioskApi.quote(cart)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        if (!q.allowed && q.violations.length > 0) track("limit_blocked", { codes: q.violations.map((v) => v.code) });
      })
      .catch(() => { if (!cancelled) setQuote(null); })
      .finally(() => { if (!cancelled) setQuoteLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(cart)]);

  const startSession = useCallback(() => {
    const id = crypto.randomUUID();
    setSessionId(id);
    kioskApi.event(id, "session_start");
    setScreen("browse");
    armIdle();
  }, [armIdle]);

  const value = useMemo<KioskState>(() => ({
    bootstrap, products, screen, go, sessionId, track,
    selectedProductId, openProduct, compareIds, setCompareIds,
    cart, setCart, addToCart, quote, quoteLoading,
    acknowledged, setAcknowledged, orderId, setOrderId, resetToAttract, refreshProducts,
  }), [bootstrap, products, screen, go, sessionId, track, selectedProductId, openProduct, compareIds, cart, addToCart, quote, quoteLoading, acknowledged, orderId, resetToAttract, refreshProducts]);

  return (
    <KioskContext.Provider value={value}>
      {screen === "attract"
        ? <AttractScreen onStart={startSession} />
        : (
          <div className="kiosk fade-in">
            <KioskHeader />
            <div className="kiosk-body">
              {screen === "browse" && <BrowseScreen />}
              {screen === "detail" && <DetailScreen />}
              {screen === "compare" && <CompareScreen />}
              {["cart", "warnings", "summary", "dispensing", "complete"].includes(screen) && <CartFlow />}
              {screen === "quiz" && <QuizScreen />}
              {screen === "learn" && <LearnScreen />}
            </div>
            {["browse", "detail", "compare", "quiz", "learn"].includes(screen) && <KioskFooterBar />}
          </div>
        )}
    </KioskContext.Provider>
  );
}

// ── Attract / idle screen (spec §2) ──────────────────────────────────

function AttractScreen({ onStart }: { onStart: () => void }) {
  const { bootstrap, products } = useKiosk();
  const slides = bootstrap.promotions.length > 0
    ? bootstrap.promotions
    : [{ id: "x", kind: "MESSAGE", title: "Fuel your workout", subtitle: null, productId: null, accentColor: "var(--accent)" }];
  const [index, setIndex] = useState(0);
  const rotate = Number(bootstrap.settings["kiosk.attractRotationSeconds"] ?? 7);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), rotate * 1000);
    return () => clearInterval(t);
  }, [slides.length, rotate]);

  const slide = slides[index]!;
  const featured = slide.productId ? products.find((p) => p.id === slide.productId) : null;

  return (
    <div
      className="kiosk"
      onPointerDown={onStart}
      style={{ justifyContent: "space-between", cursor: "pointer", textAlign: "center", position: "relative" }}
    >
      <div style={{ paddingTop: 56, display: "flex", justifyContent: "center", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 13, letterSpacing: "0.42em", color: "var(--text-3)", fontWeight: 700 }}>PRE-WORKOUT BAR</div>
      </div>

      {/* Theme control sits in a corner, out of the customer's path */}
      <div style={{ position: "absolute", top: 22, right: 26 }} onPointerDown={(e) => e.stopPropagation()}>
        <ThemeToggle compact />
      </div>

      <div
        key={slide.id + String(index)}
        className="rise-in"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26, padding: "0 48px" }}
      >
        {featured
          ? <ProductArt imageKey={featured.imageKey} accentColor={featured.accentColor} size={172} />
          : <div style={{ fontSize: 84 }} aria-hidden>⚡</div>}
        <h1
          style={{
            fontSize: "clamp(42px, 7.5vw, 88px)",
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.045em",
            maxWidth: 15 + "ch",
            background: `linear-gradient(135deg, ${slide.accentColor}, var(--text) 88%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {slide.title}
        </h1>
        {slide.subtitle
          ? <p style={{ fontSize: 21, color: "var(--text-2)", maxWidth: 620, lineHeight: 1.45 }}>{slide.subtitle}</p>
          : null}
        <div style={{ display: "flex", gap: 7, marginTop: 6 }}>
          {slides.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === index ? 26 : 7, height: 7, borderRadius: 4,
                background: i === index ? "var(--accent)" : "var(--surface-3)",
                transition: "all var(--slow) var(--ease-out)",
              }}
            />
          ))}
        </div>
      </div>

      <div style={{ paddingBottom: 64 }}>
        <div className="btn btn-primary btn-xl" style={{ animation: "breathe 2.6s var(--ease-out) infinite" }}>
          Tap to start
        </div>
        <div style={{ color: "var(--text-3)", fontSize: 13, marginTop: 16 }}>
          Touch anywhere on the screen
        </div>
      </div>
    </div>
  );
}

// ── Chrome ───────────────────────────────────────────────────────────

/** Progress rail so the customer always knows where they are in checkout. */
const CHECKOUT_STEPS: { key: KioskScreen; label: string }[] = [
  { key: "cart", label: "Your mix" },
  { key: "warnings", label: "Review" },
  { key: "summary", label: "Pay" },
];

function KioskHeader() {
  const { screen, go, resetToAttract, cart } = useKiosk();
  const backTarget: Partial<Record<KioskScreen, KioskScreen>> = {
    detail: "browse", compare: "browse", cart: "browse", quiz: "browse", learn: "browse",
    warnings: "cart", summary: "warnings",
  };
  const back = backTarget[screen];
  const stepIndex = CHECKOUT_STEPS.findIndex((s) => s.key === screen);

  return (
    <div className="kiosk-header">
      <div style={{ flex: 1, display: "flex", justifyContent: "flex-start" }}>
        {back ? <button className="btn btn-ghost btn-sm" onClick={() => go(back)}>← Back</button> : <span />}
      </div>

      {stepIndex >= 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {CHECKOUT_STEPS.map((s, i) => (
            <React.Fragment key={s.key}>
              {i > 0 && (
                <div style={{ width: 26, height: 2, borderRadius: 2, background: i <= stepIndex ? "var(--accent)" : "var(--surface-3)", transition: "background-color var(--normal) var(--ease-out)" }} />
              )}
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                color: i === stepIndex ? "var(--text)" : i < stepIndex ? "var(--text-2)" : "var(--text-3)",
                fontSize: 13, fontWeight: i === stepIndex ? 650 : 500,
              }}>
                <span style={{
                  display: "grid", placeItems: "center",
                  width: 20, height: 20, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                  background: i <= stepIndex ? "var(--accent)" : "var(--surface-3)",
                  color: i <= stepIndex ? "var(--accent-ink)" : "var(--text-3)",
                  transition: "all var(--normal) var(--ease-out)",
                }}>
                  {i < stepIndex ? "✓" : i + 1}
                </span>
                {s.label}
              </div>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ fontWeight: 700, letterSpacing: "0.3em", fontSize: 12.5, color: "var(--text-3)" }}>PRE-WORKOUT BAR</div>
      )}

      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
        <ThemeToggle compact />
        <button className="btn btn-ghost btn-sm" onClick={() => resetToAttract(cart.length > 0 ? "session_timeout" : undefined)}>
          Start over
        </button>
      </div>
    </div>
  );
}

function KioskFooterBar() {
  const { go, cart, quote, screen } = useKiosk();
  const nav: { key: KioskScreen; icon: string; label: string }[] = [
    { key: "browse", icon: "🛍", label: "Browse" },
    { key: "quiz", icon: "🎯", label: "Find My Pre" },
    { key: "learn", icon: "📖", label: "Learn" },
  ];
  return (
    <div className="kiosk-footer">
      <div style={{ display: "flex", gap: 8 }}>
        {nav.map((n) => (
          <button key={n.key} className={`chip ${screen === n.key ? "active" : ""}`} onClick={() => go(n.key)}>
            {n.icon} {n.label}
          </button>
        ))}
      </div>
      <button className="btn btn-primary" disabled={cart.length === 0} onClick={() => go("cart")}>
        My mix
        {cart.length > 0 ? (
          <span style={{
            display: "grid", placeItems: "center", minWidth: 22, height: 22, padding: "0 6px",
            borderRadius: "var(--r-full)", background: "rgba(255,255,255,0.22)", fontSize: 12.5, fontWeight: 700,
          }}>
            {cart.length}
          </span>
        ) : null}
        {quote ? <span style={{ opacity: 0.85 }}>${(quote.totalCents / 100).toFixed(2)}</span> : null}
      </button>
    </div>
  );
}
