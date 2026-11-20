import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_STORAGE_KEY,
  type Locale,
  type MessageParams,
} from "./types";
import { messages } from "./messages";
import {
  formatDisplayDate,
  formatDisplayDateTime,
  usesYmdSlash,
} from "@/lib/date-format";

type I18nContextValue = {
  locale: Locale;
  dir: "rtl" | "ltr";
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: MessageParams) => string;
  dateLocale: string;
  /** ar/ku → yyyy/mm/dd; en → short locale date */
  formatDate: (value: string | Date | null | undefined, fallback?: string) => string;
  formatDateTime: (value: string | Date | null | undefined, fallback?: string) => string;
  usesYmdSlash: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLocale(): Locale {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw === "ar" || raw === "en" || raw === "ku") return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE;
}

function formatMessage(template: string, params?: MessageParams) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    params[key] === undefined || params[key] === null ? `{${key}}` : String(params[key])
  );
}

function applyDocumentLocale(locale: Locale) {
  const meta = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];
  const root = document.documentElement;
  root.lang = meta.htmlLang;
  root.dir = meta.dir;
  root.dataset.locale = locale;
  document.title =
    locale === "en"
      ? "Smart Restaurant Manager 2026"
      : locale === "ku"
        ? "Rêveberiya Restorana Zîrek 2026"
        : "نظام إدارة المطاعم الذكي 2026";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === "undefined" ? DEFAULT_LOCALE : readStoredLocale()
  );

  useEffect(() => {
    applyDocumentLocale(locale);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: string, params?: MessageParams) => {
      const dict = messages[locale] ?? messages.ar;
      const fallback = messages.ar[key];
      const template = dict[key] ?? fallback ?? key;
      return formatMessage(template, params);
    },
    [locale]
  );

  const meta = LOCALES.find((l) => l.id === locale) ?? LOCALES[0];

  const formatDate = useCallback(
    (value: string | Date | null | undefined, fallback = "—") =>
      formatDisplayDate(value, locale, fallback),
    [locale]
  );

  const formatDateTime = useCallback(
    (value: string | Date | null | undefined, fallback = "—") =>
      formatDisplayDateTime(value, locale, fallback),
    [locale]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: meta.dir,
      setLocale,
      t,
      dateLocale: meta.dateLocale,
      formatDate,
      formatDateTime,
      usesYmdSlash: usesYmdSlash(locale),
    }),
    [locale, meta.dir, meta.dateLocale, setLocale, t, formatDate, formatDateTime]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within LocaleProvider");
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}
