export type CurrencyCode = "iqd" | "usd" | "eur" | "custom";

export type CurrencySettings = {
  currencyCode: CurrencyCode;
  currencySymbol: string;
  currencyName: string;
  decimalPlaces: number;
};

export const CURRENCY_PRESETS: {
  code: Exclude<CurrencyCode, "custom">;
  name: string;
  symbol: string;
  decimalPlaces: number;
  hint: string;
}[] = [
  { code: "iqd", name: "دينار عراقي", symbol: "د.ع", decimalPlaces: 0, hint: "IQD" },
  { code: "usd", name: "دولار أمريكي", symbol: "$", decimalPlaces: 2, hint: "USD" },
  { code: "eur", name: "يورو", symbol: "€", decimalPlaces: 2, hint: "EUR" },
];

export const DEFAULT_CURRENCY: CurrencySettings = {
  currencyCode: "iqd",
  currencySymbol: "د.ع",
  currencyName: "دينار عراقي",
  decimalPlaces: 0,
};

export function clampDecimalPlaces(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(4, Math.max(0, Math.floor(n)));
}

export function formatMoney(
  amount: number | string | null | undefined,
  currency: Partial<CurrencySettings> = DEFAULT_CURRENCY
): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const decimals = clampDecimalPlaces(currency.decimalPlaces ?? 0);
  const symbol = (currency.currencySymbol || DEFAULT_CURRENCY.currencySymbol).trim() || "د.ع";
  const formatted = new Intl.NumberFormat("en-IQ", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
  return `${formatted} ${symbol}`;
}

export function formatMoneyValue(
  amount: number | string | null | undefined,
  decimalPlaces = 0
): string {
  const n = Number(amount ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  const decimals = clampDecimalPlaces(decimalPlaces);
  return new Intl.NumberFormat("en-IQ", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(safe);
}
