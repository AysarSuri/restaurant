import { useEffect, useState } from "react";
import {
  getKeyboardDefaultLang,
  type KeyboardDefaultLang,
} from "@/lib/device-pad-prefs";
import { useI18n } from "@/i18n";

/** Default language for MultilingualKeyboard on this device. */
export function useKeyboardDefaultLang(): KeyboardDefaultLang {
  const { locale } = useI18n();
  const localeFallback: KeyboardDefaultLang =
    locale === "en" || locale === "ku" || locale === "ar" ? locale : "ar";
  const [lang, setLang] = useState<KeyboardDefaultLang>(() =>
    getKeyboardDefaultLang(localeFallback)
  );

  useEffect(() => {
    const sync = () => setLang(getKeyboardDefaultLang(localeFallback));
    sync();
    window.addEventListener("rms-pad-prefs-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rms-pad-prefs-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [localeFallback]);

  return lang;
}
