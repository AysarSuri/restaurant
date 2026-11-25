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
 * the same MultilingualKeyboard used in POS — across every menu/form.
 */
export function VirtualKeyboardHost({ active = true }: HostProps) {
  const enabled = useDeviceVirtualKeyboard(active);
  const { t, locale } = useI18n();
  const [session, setSession] = useState<PadSession | null>(null);
  const openingRef = useRef(false);

  const close = useCallback(() => {
    setSession(null);
    openingRef.current = false;
  }, []);

  const openFor = useCallback((el: HTMLInputElement | HTMLTextAreaElement) => {
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
      if (!isTextKeyboardField(target)) return;
      if (session?.el === target) return;
      e.preventDefault();
      openFor(target);
    };

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) return;
      const field =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target
          : target.closest("input, textarea");
      if (!isTextKeyboardField(field)) return;
      if (session?.el === field) return;
      e.preventDefault();
      openFor(field);
    };

    document.addEventListener("focusin", onFocusIn, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("focusin", onFocusIn, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [enabled, openFor, close, session]);

  const defaultLang =
    locale === "en" || locale === "ku" || locale === "ar" ? locale : "ar";

  if (!enabled) return null;

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
