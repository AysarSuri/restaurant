import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type AuthRole =
  | "admin"
  | "manager"
  | "cashier"
  | "waiter"
  | "kitchen"
  | "delivery"
  | "table";

export type AuthClaims = {
  sub: string;
  role: AuthRole;
  name: string;
  employeeId?: number;
  tableId?: number;
  tableNumber?: string;
  allBranches: boolean;
  branchIds: number[];
  listPermissions?: Record<string, unknown>;
  iat: number;
  exp: number;
};

const DEFAULT_DEV_SECRET = "rms-dev-only-change-me-in-production";

export function getJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }
  return DEFAULT_DEV_SECRET;
}

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlJson(value: unknown) {
  return b64url(JSON.stringify(value));
}

function fromB64url(value: string) {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function signAuthToken(
  claims: Omit<AuthClaims, "iat" | "exp" | "sub"> & { sub?: string },
  ttlSeconds = 60 * 60 * 12
): string {
  const now = Math.floor(Date.now() / 1000);
  const full: AuthClaims = {
    ...claims,
    sub:
      claims.sub ||
      (claims.employeeId != null
        ? `emp:${claims.employeeId}`
        : claims.tableId != null
          ? `table:${claims.tableId}`
          : `user:${randomBytes(6).toString("hex")}`),
    iat: now,
    exp: now + ttlSeconds,
  };
  const header = b64urlJson({ alg: "HS256", typ: "JWT" });
  const payload = b64urlJson(full);
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", getJwtSecret()).update(data).digest();
  return `${data}.${b64url(sig)}`;
}

export function verifyAuthToken(token: string): AuthClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const data = `${header}.${payload}`;
    const expected = createHmac("sha256", getJwtSecret()).update(data).digest();
    const got = fromB64url(signature);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      return null;
    }
    const claims = JSON.parse(fromB64url(payload).toString("utf8")) as AuthClaims;
    if (!claims || typeof claims !== "object") return null;
    if (!claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    if (!claims.role || !claims.name) return null;
    return claims;
  } catch {
    return null;
  }
}

export function safeEqualPin(a: string, b: string): boolean {
  const left = Buffer.from(String(a ?? ""), "utf8");
  const right = Buffer.from(String(b ?? ""), "utf8");
  if (left.length !== right.length) {
    // Still do a compare to reduce timing leak on length
    const dummy = Buffer.alloc(left.length);
    timingSafeEqual(left, dummy);
    return false;
  }
  return timingSafeEqual(left, right);
}

export function stripEmployeePin<T extends Record<string, unknown>>(row: T) {
  const { pin: _pin, ...rest } = row as T & { pin?: unknown };
  return {
    ...rest,
    hasPin: Boolean(_pin && String(_pin).trim()),
  };
}
