import React from "react";
import { Card } from "@/components/ui-elements";
import { useI18n } from "@/i18n";

export default function Reports() {
  const { t } = useI18n();

  return (
    <div className="space-y-6 text-foreground">
      <div>
        <h2 className="text-2xl font-bold">{t("reports.title")}</h2>
        <p className="text-xs text-primary font-display tracking-widest uppercase">{t("reports.kicker")}</p>
      </div>

      <Card className="p-12 text-center flex flex-col items-center justify-center h-[60vh]">
        <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mb-6">
          <span className="text-4xl text-primary">📊</span>
        </div>
        <h3 className="text-2xl font-bold mb-2">{t("reports.soonTitle")}</h3>
        <p className="text-muted-foreground max-w-md mx-auto">{t("reports.soonBody")}</p>
      </Card>
    </div>
  );
}
