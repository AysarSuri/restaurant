import React from "react";
import { useGetOrders } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Badge } from "@/components/ui-elements";
import { Order } from "@workspace/api-client-react";
import { useI18n } from "@/i18n";

export default function Orders() {
  const { data: orders, isLoading } = useGetOrders();
  const { t, dateLocale } = useI18n();

  const columns = [
    { key: "orderNumber", header: t("orders.number"), render: (item: Order) => <span className="font-display font-bold text-primary">#{item.orderNumber.slice(-6)}</span> },
    { key: "type", header: t("common.type"), render: (item: Order) => item.type === "dine_in" ? t("order.dineIn") : item.type === "takeaway" ? t("order.takeaway") : t("order.delivery") },
    { key: "total", header: t("common.total"), render: (item: Order) => <span className="font-display font-bold">{new Intl.NumberFormat("en-IQ").format(item.total)} {t("common.iqd")}</span> },
    { key: "status", header: t("common.status"), render: (item: Order) => (
      <Badge variant={item.status === "paid" ? "success" : item.status === "cancelled" ? "destructive" : "warning"}>
        {item.status}
      </Badge>
    )},
    { key: "createdAt", header: t("common.time"), render: (item: Order) => <span className="font-display">{new Date(item.createdAt).toLocaleString(dateLocale)}</span> }
  ];

  return (
    <CrudTable
      title={t("orders.log")}
      titleEn={t("orders.kicker")}
      data={orders}
      columns={columns}
      isLoading={isLoading}
      searchKey="orderNumber"
    />
  );
}
