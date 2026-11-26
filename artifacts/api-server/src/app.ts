import path from "node:path";
import fs from "node:fs";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { ensureCategoryUploadsDir, UPLOADS_ROOT } from "./lib/category-image";
import { ensureSalesDeviceColumns } from "./lib/ensure-sales-columns";
import { ensureEmployeeColumns } from "./lib/ensure-employee-columns";
import { ensureVaultColumns } from "./lib/ensure-vault-columns";
import { ensureDatabaseSchema } from "./lib/ensure-schema";
import {
  attachAuthIfPresent,
  isPublicApiPath,
  requireAuth,
  type AuthedRequest,
} from "./middleware/require-auth";

const app: Express = express();

ensureCategoryUploadsDir();

/** Schema push (empty DB) then column ensures — await before listen. */
export async function initDatabase() {
  await ensureDatabaseSchema();
  await ensureSalesDeviceColumns();
  await ensureEmployeeColumns();
  await ensureVaultColumns();
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedCorsOrigin(origin: string | undefined, req: Request): boolean {
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const rawHost = String(
      req.headers["x-forwarded-host"] || req.headers.host || ""
    )
      .split(",")[0]
      .trim();
    // Always allow same-host (custom domain / Railway) so SPA assets & API work
    // even if CORS_ORIGIN was left on localhost.
    if (originHost && rawHost && originHost === rawHost) return true;
  } catch {
    /* ignore bad Origin */
  }
  if (corsOrigins.includes("*") || corsOrigins.includes(origin)) return true;
  if (corsOrigins.length === 0 && process.env.NODE_ENV !== "production") {
    return true;
  }
  return false;
}

// Static uploads/SPA must NOT go through CORS rejection — browsers send Origin on
// module scripts; a wrong CORS_ORIGIN was returning 403 and blanking the UI.
app.use("/uploads", express.static(UPLOADS_ROOT));

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "body.pin",
        "body.password",
      ],
      remove: true,
    },
  })
);

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", (req, res, next) => {
  cors({
    origin(origin, callback) {
      if (isAllowedCorsOrigin(origin, req)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  })(req, res, next);
});

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 900,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "طلبات كثيرة — حاول بعد لحظات",
    error: "rate_limited",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "محاولات دخول كثيرة — انتظر قليلاً ثم أعد المحاولة",
    error: "login_rate_limited",
  },
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "تم تجاوز حد عمليات التصفير",
    error: "reset_rate_limited",
  },
});

app.use("/api", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/system-reset", resetLimiter);

app.use("/api", (req: AuthedRequest, res: Response, next: NextFunction) => {
  attachAuthIfPresent(req, res, () => {
    if (isPublicApiPath(req.method, req.path)) {
      next();
      return;
    }
    requireAuth(req, res, next);
  });
});

app.use("/api", router);

function resolveStaticDir(): string | null {
  const fromEnv = process.env.STATIC_DIR?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) return fromEnv;
  const candidates = [
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "artifacts/rms/dist/public"),
    "/app/public",
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

const staticDir = resolveStaticDir();
if (staticDir) {
  logger.info({ staticDir }, "Serving SPA static files");
  app.use(
    express.static(staticDir, {
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    })
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    const indexHtml = path.join(staticDir, "index.html");
    if (!fs.existsSync(indexHtml)) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}

app.use(
  (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message.includes("not allowed by CORS") || message.includes("CORS_ORIGIN")) {
      res.status(403).json({ success: false, message: "CORS blocked", error: "cors" });
      return;
    }
    logger.error({ err }, "Unhandled error");
    res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
);

export default app;
