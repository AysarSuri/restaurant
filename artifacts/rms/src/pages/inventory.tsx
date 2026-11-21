import React from "react";
import { useGetInventoryItems } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Badge } from "@/components/ui-elements";
import { InventoryItem } from "@workspace/api-client-react";
import { useI18n } from "@/i18n";

export default function Inventory() {
  const { data: items, isLoading } = useGetInventoryItems();
  const { t } = useI18n();

  const columns = [
    { key: "nameAr", header: t("inventory.material") },
    { key: "category", header: t("menu.category") },
    { key: "currentQuantity", header: t("inventory.currentQty"), render: (item: InventoryItem) => (
      <span className={`font-display font-bold ${item.currentQuantity <= item.minimumQuantity ? "text-destructive" : "text-foreground"}`}>
        {item.currentQuantity} {item.unit}
      </span>
    )},
    { key: "status", header: t("inventory.alert"), render: (item: InventoryItem) => (
      item.currentQuantity <= item.minimumQuantity ? <Badge variant="destructive">{t("inventory.low")}</Badge> : <Badge variant="success">{t("inventory.good")}</Badge>
    )}
  ];

  return (
    <CrudTable
      title={t("inventory.title")}
      titleEn={t("inventory.kicker")}
      data={items}
      columns={columns}
      isLoading={isLoading}
      searchKey="nameAr"
      onAdd={() => alert(t("common.comingSoon"))}
    />
  );
}
