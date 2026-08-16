/**
 * Prototype authentication: configurable admin PIN → opaque bearer token.
 *
 * The schema already models Users with roles, password-hash and MFA columns,
 * so upgrading to username/password + MFA + remote login means adding a new
 * login route — the session/role plumbing below stays the same.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "@prisma/client";
import { prisma } from "./prisma.js";

export function hashPin(pin: string): string {
  return createHash("sha256").update(`pwx-pin:${pin}`).digest("hex");
}

interface Session {
  userId: string;
  name: string;
  role: UserRole;
  expiresAt: number;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, Session>();

export async function loginWithPin(pin: string): Promise<{ token: string; name: string; role: UserRole } | null> {
  const user = await prisma.user.findFirst({ where: { pinHash: hashPin(pin), active: true } });
  if (!user) return null;
  const token = randomBytes(24).toString("hex");
  sessions.set(token, { userId: user.id, name: user.name, role: user.role, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, name: user.name, role: user.role };
}

export function logout(token: string): void {
  sessions.delete(token);
}

// Role hierarchy: any listed role (or higher) may pass.
const ROLE_RANK: Record<UserRole, number> = {
  TECHNICIAN: 1,
  GYM_MANAGER: 2,
  BUSINESS_ADMIN: 3,
  SUPER_ADMIN: 4,
};

export interface AuthedRequest extends Request {
  auth?: { userId: string; name: string; role: UserRole };
}

export function requireRole(minRole: UserRole) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const session = token ? sessions.get(token) : undefined;
    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (ROLE_RANK[session.role] < ROLE_RANK[minRole]) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    req.auth = { userId: session.userId, name: session.name, role: session.role };
    next();
  };
}

/** Record an administrative change in the audit log (spec §32.13). */
export async function audit(req: AuthedRequest, action: string, entity: string, entityId?: string, detail?: unknown): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: req.auth?.userId,
      action,
      entity,
      entityId,
      detail: detail === undefined ? undefined : JSON.parse(JSON.stringify(detail)),
    },
  });
}
