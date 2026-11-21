import fs from "node:fs";
import path from "node:path";

/** Persistent uploads folder under the api-server package cwd */
export const UPLOADS_ROOT = path.resolve(process.cwd(), "uploads");
export const CATEGORY_UPLOADS_DIR = path.join(UPLOADS_ROOT, "categories");
export const MENU_ITEM_UPLOADS_DIR = path.join(UPLOADS_ROOT, "menu-items");

const ALLOWED = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MAX_BYTES = 4 * 1024 * 1024;

export function ensureCategoryUploadsDir() {
  fs.mkdirSync(CATEGORY_UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(MENU_ITEM_UPLOADS_DIR, { recursive: true });
}

function persistImageDataUrl(
  value: string | null | undefined,
  dir: string,
  publicPrefix: string,
  filePrefix: string
): string | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (!raw.startsWith("data:")) return raw;

  const match = raw.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+)$/);
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

  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${filePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return `${publicPrefix}/${fileName}`;
}

/**
 * Persist a browser data-URL image and return a public `/uploads/categories/...` path.
 * If value is already a normal URL/path, return it unchanged.
 */
export function persistCategoryImageDataUrl(value: string | null | undefined): string | null {
  return persistImageDataUrl(
    value,
    CATEGORY_UPLOADS_DIR,
    "/uploads/categories",
    "cat"
  );
}

/** Persist menu-item image → `/uploads/menu-items/...` */
export function persistMenuItemImageDataUrl(value: string | null | undefined): string | null {
  return persistImageDataUrl(
    value,
    MENU_ITEM_UPLOADS_DIR,
    "/uploads/menu-items",
    "item"
  );
}
