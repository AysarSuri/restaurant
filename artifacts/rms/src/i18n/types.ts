export type Locale = "ar" | "en" | "ku";

export type MessageParams = Record<string, string | number>;

export type Messages = Record<string, string>;

export const LOCALES: {
  id: Locale;
  label: string;
  nativeLabel: string;
  dir: "rtl" | "ltr";
  htmlLang: string;
  dateLocale: string;
}[] = [
  { id: "ar", label: "Arabic", nativeLabel: "العربية", dir: "rtl", htmlLang: "ar", dateLocale: "ar-IQ" },
  { id: "ku", label: "Kurdish (Badini)", nativeLabel: "Kurdî Badînî", dir: "ltr", htmlLang: "ku", dateLocale: "ku" },
  { id: "en", label: "English", nativeLabel: "English", dir: "ltr", htmlLang: "en", dateLocale: "en-US" },
];

export const DEFAULT_LOCALE: Locale = "ar";
export const LOCALE_STORAGE_KEY = "rms-locale";
