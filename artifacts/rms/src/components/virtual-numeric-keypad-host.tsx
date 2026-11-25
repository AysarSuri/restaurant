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
  active?: boolean;
};

/**
 * When the device Numbers setting is on, focusing any amount/price field
 * opens NumericKeypad across every menu/form.
 */
export function VirtualNumericKeypadHost({ active = true }: HostProps) {
  const enabled = useDeviceVirtualNumericKeypad(active);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const { t } = useI18n();
  const { data: appSettings } = useGetSettings({
    query: { staleTime: 60_000, refetchOnWindowFocus: false },
  });
  const [session, setSession] = useState<PadSession | null>(null);
  const sessionRef = useRef<PadSession | null>(null);
  sessionRef.current = session;

  const close = useCallback(() => {
    setSession(null);
    sessionRef.current = null;
  }, []);

  const openFor = useCallback((el: HTMLInputElement) => {
    if (!enabledRef.current) return;
    if (sessionRef.current?.el === el) return;
    const original = el.value ?? "";
    try {
      el.blur();
    } catch {
      /* ignore */
    }
    const next = { el, original };
    sessionRef.current = next;
    setSession(next);
  }, []);

  useEffect(() => {
    if (!enabled) {
      close();
      return;
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!enabledRef.current) return;
      const target = e.target;
      if (!(target instanceof Element)) return;
      if (target.closest("[data-global-amount-pad],[data-global-text-keyboard]")) return;
      const input =
        target instanceof HTMLInputElement ? target : target.closest("input");
      if (!isAmountMoneyField(input)) return;
      e.preventDefault();
      e.stopPropagation();
      openFor(input);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!enabledRef.current) return;
      const target = e.target;
      if (!isAmountMoneyField(target)) return;
      if (sessionRef.current?.el === target) return;
      e.preventDefault();
      openFor(target);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [enabled, openFor, close]);

  const decimals = Math.max(0, Math.min(4, Number(appSettings?.decimalPlaces) || 0));
  const suffix = appSettings?.currencySymbol?.trim() || undefined;
  const allowDecimal = decimals > 0;

  if (!active) return null;

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
