import { LOCALE_STORAGE_KEY, type Locale } from "@/i18n/types";

/** Arabic & Kurdish use fixed LTR yyyy/mm/dd (year left). */
export function usesYmdSlash(locale: Locale | string | null | undefined) {
  return locale === "ar" || locale === "ku";
}

export function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "ar" || raw === "en" || raw === "ku") return raw;
  } catch {
    /* ignore */
  }
  return "ar";
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Parse ISO date, slash date, Date, or datetime → local calendar parts. */
export function parseDateParts(
  value: string | Date | null | undefined
): { year: number; month: number; day: number } | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      year: value.getFullYear(),
      month: value.getMonth() + 1,
      day: value.getDate(),
    };
  }

  const raw = String(value).trim();
  const isoDay = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDay) {
    return {
      year: Number(isoDay[1]),
      month: Number(isoDay[2]),
      day: Number(isoDay[3]),
    };
  }

  const slashDay = raw.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (slashDay) {
    return {
      year: Number(slashDay[1]),
      month: Number(slashDay[2]),
      day: Number(slashDay[3]),
    };
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

/** yyyy/mm/dd always (Western digits). */
export function toYmdSlash(value: string | Date | null | undefined): string {
  const p = parseDateParts(value);
  if (!p) return value == null ? "" : String(value);
  return `${p.year}/${pad2(p.month)}/${pad2(p.day)}`;
}

/** Valid calendar day → ISO yyyy-mm-dd, else null. */
export function toIsoDate(value: string | Date | null | undefined): string | null {
  const p = parseDateParts(value);
  if (!p) return null;
  if (p.year < 1900 || p.year > 2100) return null;
  if (p.month < 1 || p.month > 12) return null;
  if (p.day < 1 || p.day > 31) return null;
  const d = new Date(p.year, p.month - 1, p.day);
  if (
    d.getFullYear() !== p.year ||
    d.getMonth() !== p.month - 1 ||
    d.getDate() !== p.day
  ) {
    return null;
  }
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Keep only digits and insert yyyy/mm/dd slashes while typing. */
export function maskYmdSlashInput(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}/${digits.slice(4)}`;
  return `${digits.slice(0, 4)}/${digits.slice(4, 6)}/${digits.slice(6)}`;
}

/**
 * Display date for UI/lists/reports.
 * ar/ku → yyyy/mm/dd (LTR order). en → locale short date.
 */
export function formatDisplayDate(
  value: string | Date | null | undefined,
  locale: Locale | string,
  fallback = "—"
): string {
  const p = parseDateParts(value);
  if (!p) return value == null || value === "" ? fallback : String(value);

  if (usesYmdSlash(locale)) {
    return `${p.year}/${pad2(p.month)}/${pad2(p.day)}`;
  }

  try {
    const d = new Date(p.year, p.month - 1, p.day);
    return d.toLocaleDateString("en-US");
  } catch {
    return `${pad2(p.month)}/${pad2(p.day)}/${p.year}`;
  }
}

/** Date + optional time; date part follows formatDisplayDate. */
export function formatDisplayDateTime(
  value: string | Date | null | undefined,
  locale: Locale | string,
  fallback = "—"
): string {
  if (value == null || value === "") return fallback;
  const datePart = formatDisplayDate(value, locale, "");
  if (!datePart) return fallback;

  let timePart = "";
  if (value instanceof Date) {
    if (!Number.isNaN(value.getTime())) {
      timePart = `${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`;
    }
  } else {
    const raw = String(value);
    const m = raw.match(/T(\d{2}:\d{2}(?::\d{2})?)/) || raw.match(/\s(\d{2}:\d{2}(?::\d{2})?)/);
    if (m) timePart = m[1];
  }

  return timePart ? `${datePart} ${timePart}` : datePart;
}

/** Format using the currently stored app locale (for print windows). */
export function formatDisplayDateForApp(
  value: string | Date | null | undefined,
  fallback = "—"
) {
  return formatDisplayDate(value, readStoredLocale(), fallback);
}
