import React from "react";
import { Languages } from "lucide-react";
import { LOCALES, type Locale } from "@/i18n/types";
import { useI18n } from "@/i18n/context";

type Props = {
  compact?: boolean;
  className?: string;
};

export function LanguageSwitcher({ compact = false, className = "" }: Props) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 p-0.5 ${className}`}
      role="group"
      aria-label={t("lang.switch")}
    >
      {!compact && (
        <span className="hidden sm:inline-flex items-center gap-1 px-2 text-[10px] font-bold text-muted-foreground">
          <Languages className="w-3.5 h-3.5" />
          {t("lang.label")}
        </span>
      )}
      {LOCALES.map((item) => {
        const active = locale === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setLocale(item.id as Locale)}
            title={item.nativeLabel}
            className={`rounded-full font-extrabold transition-colors touch-manipulation ${
              compact
                ? "h-8 min-w-8 px-2 text-[11px]"
                : "h-11 min-w-11 px-3 text-[13px]"
            } ${
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/70"
            }`}
          >
            {item.id === "ar" ? "ع" : item.id === "ku" ? "KU" : "EN"}
          </button>
        );
      })}
    </div>
  );
}
