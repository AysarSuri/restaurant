import React from "react";
import { useGetCustomers } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Customer } from "@workspace/api-client-react";
import { useI18n } from "@/i18n";

export default function Customers() {
  const { data: customers, isLoading } = useGetCustomers();
  const { t } = useI18n();

  const columns = [
    { key: "name", header: t("pos.clientName") },
    { key: "phone", header: t("common.phoneNumber"), render: (item: Customer) => <span className="font-display">{item.phone || "-"}</span> },
    { key: "totalOrders", header: t("customers.orderCount"), render: (item: Customer) => <span className="font-display font-bold">{item.totalOrders || 0}</span> },
    { key: "loyaltyPoints", header: t("cards.points"), render: (item: Customer) => <span className="font-display text-primary font-bold">{item.loyaltyPoints || 0}</span> }
  ];

  return (
    <CrudTable
      title={t("customers.base")}
      titleEn={t("customers.kicker")}
      data={customers}
      columns={columns}
      isLoading={isLoading}
      searchKey="name"
    />
  );
}
