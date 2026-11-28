import type { NextFunction, Request, Response } from "express";
import {
  type AuthClaims,
  type AuthRole,
  verifyAuthToken,
} from "../lib/auth-token";
import {
  getSessionForceLogoutGate,
  shouldForceLogoutSession,
} from "../lib/session-force-logout";

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

function extractDeviceKey(req: Request): string {
  const h = req.headers["x-device-key"];
  if (typeof h === "string") return h.trim();
  if (Array.isArray(h) && h[0]) return String(h[0]).trim();
  return "";
}

async function rejectIfForceLogout(
  req: AuthedRequest,
  res: Response,
  claims: AuthClaims
): Promise<boolean> {
  try {
    const gate = await getSessionForceLogoutGate();
    if (
      shouldForceLogoutSession({
        tokenIatSec: claims.iat,
        deviceKey: extractDeviceKey(req),
        gate,
      })
    ) {
      res.status(401).json({
        success: false,
        message: "تم فتح وردية جديدة على جهاز آخر — أعد تسجيل الدخول",
        error: "force_logout",
      });
      return true;
    }
  } catch {
    /* don't block requests if gate table is unavailable */
  }
  return false;
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
  void rejectIfForceLogout(req, res, claims).then((forced) => {
    if (forced) return;
    req.auth = claims;
    next();
  });
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
  if (method === "GET" && p === "/auth/session-check") return true;
  // Login screen needs directory data without a token; PINs are stripped.
  if (method === "GET" && (p === "/employees" || p === "/branches" || p === "/tables")) {
    return true;
  }
  return false;
}
