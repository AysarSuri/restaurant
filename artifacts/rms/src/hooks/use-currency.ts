import { useMemo } from "react";
import { useGetSettings } from "@workspace/api-client-react";
import {
  DEFAULT_CURRENCY,
  clampDecimalPlaces,
  formatMoney,
  formatMoneyValue,
  type CurrencyCode,
  type CurrencySettings,
} from "@/lib/currency";

export function useCurrency() {
  const { data: settings } = useGetSettings({
    query: { staleTime: 60_000, refetchOnWindowFocus: false },
  });

  const currency: CurrencySettings = useMemo(() => {
    if (!settings) return DEFAULT_CURRENCY;
    return {
      currencyCode: (settings.currencyCode as CurrencyCode) || DEFAULT_CURRENCY.currencyCode,
      currencySymbol: settings.currencySymbol || DEFAULT_CURRENCY.currencySymbol,
      currencyName: settings.currencyName || DEFAULT_CURRENCY.currencyName,
      decimalPlaces: clampDecimalPlaces(
        settings.decimalPlaces,
        DEFAULT_CURRENCY.decimalPlaces
      ),
    };
  }, [settings]);

  return {
    currency,
    symbol: currency.currencySymbol,
    name: currency.currencyName,
    decimalPlaces: currency.decimalPlaces,
    format: (amount: number | string | null | undefined) => formatMoney(amount, currency),
    formatValue: (amount: number | string | null | undefined) =>
      formatMoneyValue(amount, currency.decimalPlaces),
  };
}
