import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui-elements";
import { NumericKeypad } from "@/components/numeric-keypad";
import { useDeviceVirtualNumericKeypad } from "@/hooks/use-device-virtual-numeric-keypad";
import { useGetSettings } from "@workspace/api-client-react";
import {
  isAmountMoneyField,
  parseAmountFromInput,
  setNativeInputValue,
} from "@/lib/amount-field";
import { useI18n } from "@/i18n";

type PadSession = {
  el: HTMLInputElement;
  original: string;
};

type HostProps = {
  /** When false (logged out), do not listen or fetch */
  active?: boolean;
};

/**
 * When the device setting is on, clicking/focusing any amount/price field
 * opens the same NumericKeypad used across POS — for every form in the app.
 */
export function VirtualNumericKeypadHost({ active = true }: HostProps) {
  const enabled = useDeviceVirtualNumericKeypad(active);
  const { t } = useI18n();
  const { data: appSettings } = useGetSettings({
    query: { staleTime: 60_000, refetchOnWindowFocus: false },
  });
  const [session, setSession] = useState<PadSession | null>(null);
  const openingRef = useRef(false);

  const close = useCallback(() => {
    setSession(null);
    openingRef.current = false;
  }, []);

  const openFor = useCallback((el: HTMLInputElement) => {
    if (openingRef.current) return;
    openingRef.current = true;
    const original = el.value ?? "";
    try {
      el.blur();
    } catch {
      /* ignore */
    }
    setSession({ el, original });
  }, []);

  useEffect(() => {
    if (!enabled) {
      close();
      return;
    }

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target;
      if (!isAmountMoneyField(target)) return;
      if (session?.el === target) return;
      e.preventDefault();
      openFor(target);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const input = target instanceof HTMLInputElement ? target : target.closest("input");
      if (!isAmountMoneyField(input)) return;
      if (session?.el === input) return;
      // Prefer opening before OS keyboard appears
      e.preventDefault();
      openFor(input);
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [enabled, openFor, close, session]);

  const decimals = Math.max(0, Math.min(4, Number(appSettings?.decimalPlaces) || 0));
  const suffix = appSettings?.currencySymbol?.trim() || undefined;
  const allowDecimal = decimals > 0;

  if (!enabled) return null;

  return (
    <Dialog
      isOpen={Boolean(session)}
      onClose={() => {
        if (session) setNativeInputValue(session.el, session.original);
        close();
      }}
      hideHeader
      maxWidth="max-w-sm"
      layer="overlay"
    >
      <div data-global-amount-pad>
        {session ? (
          <NumericKeypad
            mode="amount"
            value={parseAmountFromInput(session.el)}
            allowDecimal={allowDecimal}
            maxDecimalPlaces={allowDecimal ? decimals : 0}
            suffix={suffix}
            label={t("settings.enterValue")}
            onCancel={() => {
              setNativeInputValue(session.el, session.original);
              close();
            }}
            onConfirm={(n) => {
              const text =
                allowDecimal && decimals > 0
                  ? String(Number(n.toFixed(decimals)))
                  : String(Math.round(n));
              setNativeInputValue(session.el, text);
              close();
              try {
                session.el.focus({ preventScroll: true });
                session.el.blur();
              } catch {
                /* ignore */
              }
            }}
          />
        ) : null}
      </div>
    </Dialog>
  );
}
