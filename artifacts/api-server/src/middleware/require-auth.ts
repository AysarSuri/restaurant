import type { NextFunction, Request, Response } from "express";
import {
  type AuthClaims,
  type AuthRole,
  verifyAuthToken,
} from "../lib/auth-token";

export type AuthedRequest = Request & {
  auth?: AuthClaims;
};

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() || null;
  }
  const cookie = req.headers.cookie;
  if (typeof cookie === "string") {
    const match = cookie.match(/(?:^|;\s*)rms_token=([^;]+)/);
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  return null;
}

export function attachAuthIfPresent(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction
) {
  const token = extractBearer(req);
  if (token) {
    const claims = verifyAuthToken(token);
    if (claims) req.auth = claims;
  }
  next();
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({
      success: false,
      message: "يجب تسجيل الدخول أولاً",
      error: "unauthorized",
    });
    return;
  }
  const claims = verifyAuthToken(token);
  if (!claims) {
    res.status(401).json({
      success: false,
      message: "جلسة غير صالحة أو منتهية — أعد تسجيل الدخول",
      error: "invalid_token",
    });
    return;
  }
  req.auth = claims;
  next();
}

export function requireRoles(...roles: AuthRole[]) {
  const allowed = new Set(roles);
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({
        success: false,
        message: "يجب تسجيل الدخول أولاً",
        error: "unauthorized",
      });
      return;
    }
    if (!allowed.has(req.auth.role)) {
      res.status(403).json({
        success: false,
        message: "لا تملك صلاحية تنفيذ هذه العملية",
        error: "forbidden",
      });
      return;
    }
    next();
  };
}

/** Paths under /api that stay public (login / health / bootstrap reads). */
export function isPublicApiPath(method: string, path: string): boolean {
  const p = path.split("?")[0] || "/";
  if (p === "/healthz" || p === "/health" || p === "/") return true;
  if (method === "POST" && p === "/auth/login") return true;
  // Login screen needs directory data without a token; PINs are stripped.
  if (method === "GET" && (p === "/employees" || p === "/branches" || p === "/tables")) {
    return true;
  }
  return false;
}
