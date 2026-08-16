import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { kioskApi, type Bootstrap, type ProductCard, type Quote } from "../api/client";
import { ProductArt, Spinner, ErrorBox } from "../design/components";
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
  const slides = bootstrap.promotions.length > 0 ? bootstrap.promotions : [{ id: "x", kind: "MESSAGE", title: "Fuel your workout", subtitle: null, productId: null, accentColor: "#7c5cff" }];
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
      style={{ justifyContent: "space-between", cursor: "pointer", textAlign: "center" }}
    >
      <div style={{ paddingTop: 64 }}>
        <div style={{ fontSize: 15, letterSpacing: "0.35em", color: "var(--ink-3)", fontWeight: 700 }}>PRE-WORKOUT BAR</div>
      </div>

      <div key={slide.id + String(index)} className="fade-in" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "0 48px" }}>
        {featured
          ? <ProductArt imageKey={featured.imageKey} accentColor={featured.accentColor} size={180} radius={36} />
          : <div style={{ fontSize: 96 }} aria-hidden>⚡</div>}
        <h1 style={{ fontSize: "clamp(40px, 7vw, 84px)", fontWeight: 900, lineHeight: 1.05, background: `linear-gradient(120deg, ${slide.accentColor}, #ffffff)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {slide.title}
        </h1>
        {slide.subtitle ? <p style={{ fontSize: 22, color: "var(--ink-2)", maxWidth: 640 }}>{slide.subtitle}</p> : null}
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          {slides.map((_, i) => (
            <div key={i} style={{ width: i === index ? 24 : 8, height: 8, borderRadius: 4, background: i === index ? "var(--brand)" : "var(--bg-3)", transition: "all 0.3s ease" }} />
          ))}
        </div>
      </div>

      <div style={{ paddingBottom: 72 }}>
        <div className="btn btn-primary btn-xl" style={{ animation: "pulse 2.2s ease infinite" }}>
          👆&nbsp; TAP TO START
        </div>
      </div>
    </div>
  );
}

// ── Chrome ───────────────────────────────────────────────────────────

function KioskHeader() {
  const { screen, go, resetToAttract, cart } = useKiosk();
  const backTarget: Partial<Record<KioskScreen, KioskScreen>> = {
    detail: "browse", compare: "browse", cart: "browse", quiz: "browse", learn: "browse",
    warnings: "cart", summary: "warnings",
  };
  const back = backTarget[screen];
  return (
    <div className="kiosk-header">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {back && screen !== "browse"
          ? <button className="btn btn-ghost" onClick={() => go(back)}>← Back</button>
          : <div style={{ width: 4 }} />}
      </div>
      <div style={{ fontWeight: 900, letterSpacing: "0.24em", fontSize: 15, color: "var(--ink-2)" }}>PRE-WORKOUT BAR</div>
      <button className="btn btn-ghost" onClick={() => resetToAttract(cart.length > 0 ? "session_timeout" : undefined)}>✕ Start over</button>
    </div>
  );
}

function KioskFooterBar() {
  const { go, cart, quote, screen } = useKiosk();
  return (
    <div className="kiosk-footer">
      <div style={{ display: "flex", gap: 10 }}>
        <button className={`filter-chip ${screen === "browse" ? "active" : ""}`} onClick={() => go("browse")}>🛍 Browse</button>
        <button className={`filter-chip ${screen === "quiz" ? "active" : ""}`} onClick={() => go("quiz")}>🎯 Find My Pre</button>
        <button className={`filter-chip ${screen === "learn" ? "active" : ""}`} onClick={() => go("learn")}>📖 Learn</button>
      </div>
      <button className="btn btn-primary" disabled={cart.length === 0} onClick={() => go("cart")}>
        🥤 My Mix{cart.length > 0 ? ` (${cart.length})` : ""}{quote ? ` · $${(quote.totalCents / 100).toFixed(2)}` : ""}
      </button>
    </div>
  );
}
