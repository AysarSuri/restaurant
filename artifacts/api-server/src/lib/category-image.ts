import fs from "node:fs";
import path from "node:path";
import { and, eq, isNotNull, like } from "drizzle-orm";
import { db } from "@workspace/db";
import { menuCategoriesTable, menuItemsTable } from "@workspace/db/schema";
import { logger } from "./logger";

/**
 * Resolve uploads root for legacy `/uploads/...` files.
 * Railway/Docker runs from repo root; local API may run from `artifacts/api-server`.
 */
function resolveUploadsRoot(): string {
  const fromEnv = process.env.UPLOADS_DIR?.trim();
  const candidates = [
    fromEnv,
    path.resolve(process.cwd(), "uploads"),
    path.resolve(process.cwd(), "artifacts/api-server/uploads"),
    path.resolve(process.cwd(), "..", "uploads"),
  ].filter((p): p is string => Boolean(p));
  for (const dir of candidates) {
    try {
      if (fs.existsSync(dir)) return dir;
    } catch {
      /* ignore */
    }
  }
  return path.resolve(process.cwd(), "uploads");
}

export const UPLOADS_ROOT = resolveUploadsRoot();
export const CATEGORY_UPLOADS_DIR = path.join(UPLOADS_ROOT, "categories");
export const MENU_ITEM_UPLOADS_DIR = path.join(UPLOADS_ROOT, "menu-items");

const ALLOWED = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MAX_BYTES = 4 * 1024 * 1024;

export function ensureCategoryUploadsDir() {
  try {
    fs.mkdirSync(CATEGORY_UPLOADS_DIR, { recursive: true });
    fs.mkdirSync(MENU_ITEM_UPLOADS_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Store images in DB as data URLs (same idea as branch/settings logos)
 * so Railway redeploys never wipe category/item drawings.
 * Legacy `/uploads/...` paths are left unchanged for static serving / migration.
 */
function persistImageDataUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Already a public path or remote URL — keep as-is
  if (!raw.startsWith("data:")) return raw;

  const match = raw.match(
    /^data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) {
    throw new Error("صيغة الصورة غير صالحة");
  }

  let ext = match[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  if (ext.includes("+")) ext = ext.split("+")[0];
  if (!ALLOWED.has(ext)) {
    throw new Error("يُسمح بـ PNG أو JPG أو WEBP أو GIF فقط");
  }

  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length) {
    throw new Error("ملف الصورة فارغ");
  }
  if (buffer.length > MAX_BYTES) {
    throw new Error("حجم الصورة كبير جداً (الحد 4MB)");
  }

  const mime = MIME[ext] || "image/jpeg";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

/** Persist category image as a durable data URL in the database. */
export function persistCategoryImageDataUrl(
  value: string | null | undefined
): string | null {
  return persistImageDataUrl(value);
}

/** Persist menu-item image as a durable data URL in the database. */
export function persistMenuItemImageDataUrl(
  value: string | null | undefined
): string | null {
  return persistImageDataUrl(value);
}

function filePathFromPublicUpload(publicPath: string): string | null {
  const raw = publicPath.trim();
  if (!raw.startsWith("/uploads/")) return null;
  const rel = raw.slice("/uploads/".length).replace(/\\/g, "/");
  if (!rel || rel.includes("..")) return null;
  return path.join(UPLOADS_ROOT, ...rel.split("/"));
}

function dataUrlFromUploadFile(publicPath: string): string | null {
  const filePath = filePathFromPublicUpload(publicPath);
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mime = MIME[ext === "jpeg" ? "jpg" : ext];
  if (!mime) return null;
  try {
    const buf = fs.readFileSync(filePath);
    if (!buf.length || buf.length > MAX_BYTES) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

let migratePromise: Promise<void> | null = null;

/**
 * Convert legacy `/uploads/...` image_url rows into data URLs when the file
 * still exists on disk (so drawings survive without re-upload).
 */
export async function migrateUploadImagesToDataUrls() {
  if (migratePromise) return migratePromise;
  migratePromise = (async () => {
    try {
      ensureCategoryUploadsDir();

      const cats = await db
        .select({
          id: menuCategoriesTable.id,
          imageUrl: menuCategoriesTable.imageUrl,
        })
        .from(menuCategoriesTable)
        .where(
          and(
            isNotNull(menuCategoriesTable.imageUrl),
            like(menuCategoriesTable.imageUrl, "/uploads/%")
          )
        );

      let catConverted = 0;
      for (const row of cats) {
        const dataUrl = dataUrlFromUploadFile(String(row.imageUrl ?? ""));
        if (!dataUrl) continue;
        await db
          .update(menuCategoriesTable)
          .set({ imageUrl: dataUrl })
          .where(eq(menuCategoriesTable.id, row.id));
        catConverted += 1;
      }

      const items = await db
        .select({
          id: menuItemsTable.id,
          imageUrl: menuItemsTable.imageUrl,
        })
        .from(menuItemsTable)
        .where(
          and(
            isNotNull(menuItemsTable.imageUrl),
            like(menuItemsTable.imageUrl, "/uploads/%")
          )
        );

      let itemConverted = 0;
      for (const row of items) {
        const dataUrl = dataUrlFromUploadFile(String(row.imageUrl ?? ""));
        if (!dataUrl) continue;
        await db
          .update(menuItemsTable)
          .set({ imageUrl: dataUrl })
          .where(eq(menuItemsTable.id, row.id));
        itemConverted += 1;
      }

      if (catConverted > 0 || itemConverted > 0) {
        logger.info(
          { categories: catConverted, items: itemConverted },
          "Migrated upload images into database"
        );
      }
    } catch (err) {
      logger.warn({ err }, "Upload image migration skipped");
    }
  })();
  return migratePromise;
}
