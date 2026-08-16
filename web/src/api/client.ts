/**
 * Typed API client. The kiosk NEVER computes safety numbers itself — it
 * displays what /quote and /orders return (spec §32.5).
 */

export interface ProductCard {
  id: string;
  brand: string;
  name: string;
  flavor: string;
  description: string;
  imageKey: string;
  accentColor: string;
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
  dietary: { vegan: boolean; sugarFree: boolean; dyeFree: boolean } | null;
  tags: { slug: string; label: string }[];
  available: boolean;
  lowStock: boolean;
}

export interface MajorIngredient {
  ingredientId: string;
  name: string;
  amountPerScoop: number;
  unit: string;
  category: string;
}

export interface ProductDetail extends ProductCard {
  supplementFacts: { label: string; amount: number; unit: string }[];
  majorIngredients: MajorIngredient[];
  allIngredients: (MajorIngredient & { major: boolean })[];
  warnings: { id: string; severity: string; title: string; body: string }[];
}

export interface IngredientInfo {
  id: string;
  name: string;
  category: string;
  unit: string;
  plainExplanation: string;
  sensation: string;
  technicalExplanation: string;
  typicalDoseMin: number;
  typicalDoseMax: number;
  warningInfo: string | null;
}

export interface Quote {
  allowed: boolean;
  items: {
    productId: string; brand: string; name: string; flavor: string; scoops: number;
    unitPriceCents: number; lineTotalCents: number; gramsTarget: number; accentColor: string; imageKey: string;
  }[];
  totalCents: number;
  totalGrams: number;
  totals: { ingredientId: string; name: string; unit: string; amount: number; tracked: boolean }[];
  limits: { ingredientId: string; ingredientName: string; unit: string; amount: number; max: number; remaining: number; exceeded: boolean }[];
  warnings: { id: string; code: string; severity: "INFO" | "CAUTION" | "IMPORTANT" | "BLOCKING"; title: string; body: string; requiresAcknowledgement: boolean }[];
  violations: { code: string; message: string; suggestions: string[] }[];
}

export interface Order {
  id: string;
  status: "PENDING_PAYMENT" | "PAID" | "DISPENSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  totalCents: number;
  totalCaffeineMg: number;
  failureReason: string | null;
  paymentRef: string | null;
  items: { productId: string; brand: string; name: string; flavor: string; scoops: number; lineTotalCents: number }[];
  dispensing: { productName: string; status: "QUEUED" | "MEASURING" | "DISPENSING" | "READY" | "FAULTED"; gramsTarget: number; gramsActual: number | null; error: string | null }[];
}

export interface Bootstrap {
  machine: { id: string; serial: string; name: string };
  settings: Record<string, unknown>;
  promotions: { id: string; kind: string; title: string; subtitle: string | null; productId: string | null; accentColor: string }[];
  education: { id: string; slug: string; title: string; body: string; emoji: string }[];
  tags: { slug: string; label: string }[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public detail?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`, (body as { detail?: unknown }).detail);
  return body as T;
}

export const kioskApi = {
  bootstrap: () => request<Bootstrap>("/api/kiosk/bootstrap"),
  products: () => request<ProductCard[]>("/api/kiosk/products"),
  product: (id: string) => request<ProductDetail>(`/api/kiosk/products/${id}`),
  ingredient: (id: string) => request<IngredientInfo>(`/api/kiosk/ingredients/${id}`),
  quote: (items: { productId: string; scoops: number }[]) =>
    request<Quote>("/api/kiosk/quote", { method: "POST", body: JSON.stringify({ items }) }),
  order: (payload: { sessionId?: string; items: { productId: string; scoops: number }[]; acknowledgedWarningIds: string[] }) =>
    request<Order>("/api/kiosk/orders", { method: "POST", body: JSON.stringify(payload) }),
  orderStatus: (id: string) => request<Order>(`/api/kiosk/orders/${id}`),
  quiz: (answers: Record<string, string>) =>
    request<{ productId: string; brand: string; name: string; flavor: string; accentColor: string; imageKey: string; caffeineMgPerScoop: number; score: number; reasons: string[] }[]>(
      "/api/kiosk/quiz", { method: "POST", body: JSON.stringify(answers) }),
  event: (sessionId: string | undefined, type: string, payload?: Record<string, unknown>) => {
    void fetch("/api/kiosk/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, type, payload }),
    }).catch(() => {});
  },
};

// ── Admin ────────────────────────────────────────────────────────────

let adminToken: string | null = sessionStorage.getItem("pwx-admin-token");

export function setAdminToken(token: string | null): void {
  adminToken = token;
  if (token) sessionStorage.setItem("pwx-admin-token", token);
  else sessionStorage.removeItem("pwx-admin-token");
}

export async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    headers: { "content-type": "application/json", ...(adminToken ? { authorization: `Bearer ${adminToken}` } : {}) },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
