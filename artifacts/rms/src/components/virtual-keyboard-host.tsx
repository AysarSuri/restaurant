import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui-elements";
import { MultilingualKeyboard } from "@/components/multilingual-keyboard";
import { useDeviceVirtualKeyboard } from "@/hooks/use-device-virtual-keyboard";
import { isTextKeyboardField, setNativeTextValue } from "@/lib/text-field";
import { useI18n } from "@/i18n";

type PadSession = {
  el: HTMLInputElement | HTMLTextAreaElement;
  original: string;
};

type HostProps = {
  active?: boolean;
};

/**
 * When the device Keyboard setting is on, focusing any text field opens
 * MultilingualKeyboard across every menu/form.
 */
export function VirtualKeyboardHost({ active = true }: HostProps) {
  const enabled = useDeviceVirtualKeyboard(active);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const { t, locale } = useI18n();
  const [session, setSession] = useState<PadSession | null>(null);
  const sessionRef = useRef<PadSession | null>(null);
  sessionRef.current = session;

  const close = useCallback(() => {
    setSession(null);
    sessionRef.current = null;
  }, []);

  const openFor = useCallback((el: HTMLInputElement | HTMLTextAreaElement) => {
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
      if (target.closest("[data-global-text-keyboard],[data-global-amount-pad]")) return;
      const field =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target
          : target.closest("input, textarea");
      if (!isTextKeyboardField(field)) return;
      e.preventDefault();
      e.stopPropagation();
      openFor(field);
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!enabledRef.current) return;
      const target = e.target;
      if (!isTextKeyboardField(target)) return;
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

  const defaultLang =
    locale === "en" || locale === "ku" || locale === "ar" ? locale : "ar";

  if (!active) return null;

  return (
    <Dialog
      isOpen={Boolean(session)}
      onClose={() => {
        if (session) setNativeTextValue(session.el, session.original);
        close();
      }}
      hideHeader
      maxWidth="max-w-5xl"
      layer="overlay"
    >
      <div data-global-text-keyboard>
        {session ? (
          <MultilingualKeyboard
            value={session.el.value ?? ""}
            defaultLang={defaultLang}
            label={t("settings.enterText")}
            onChange={(v) => setNativeTextValue(session.el, v)}
            onCancel={() => {
              setNativeTextValue(session.el, session.original);
              close();
            }}
            onConfirm={(v) => {
              setNativeTextValue(session.el, v);
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
