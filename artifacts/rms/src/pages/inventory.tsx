import React from "react";
import { useGetInventoryItems } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Badge } from "@/components/ui-elements";
import { InventoryItem } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Inventory() {
  const { data: items, isLoading } = useGetInventoryItems();

  const columns = [
    { key: "nameAr", header: "المادة" },
    { key: "category", header: "التصنيف" },
    { key: "currentQuantity", header: "الكمية الحالية", render: (item: InventoryItem) => (
      <span className={`font-display font-bold ${item.currentQuantity <= item.minimumQuantity ? 'text-destructive' : 'text-foreground'}`}>
        {item.currentQuantity} {item.unit}
      </span>
    )},
    { key: "status", header: "تنبيه", render: (item: InventoryItem) => (
      item.currentQuantity <= item.minimumQuantity ? <Badge variant="destructive">منخفض</Badge> : <Badge variant="success">جيد</Badge>
    )}
  ];

  return (
    <CrudTable 
      title="إدارة المخزون" 
      titleEn="Inventory" 
      data={items} 
      columns={columns} 
      isLoading={isLoading}
      searchKey="nameAr"
      onAdd={() => alert("سيتم إضافته قريباً")}
    />
  );
}
