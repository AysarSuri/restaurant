import React from "react";
import { useGetExpenses } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Expense } from "@workspace/api-client-react";
import { useI18n } from "@/i18n";

export default function Expenses() {
  const { data: expenses, isLoading } = useGetExpenses();
  const { t, dateLocale } = useI18n();

  const columns = [
    { key: "descriptionAr", header: t("expenses.statement") },
    { key: "category", header: t("menu.category") },
    { key: "amount", header: t("common.amount"), render: (item: Expense) => <span className="font-display font-bold text-destructive">{new Intl.NumberFormat("en-IQ").format(item.amount)} {t("common.iqd")}</span> },
    { key: "date", header: t("common.date"), render: (item: Expense) => <span className="font-display">{new Date(item.date).toLocaleDateString(dateLocale)}</span> }
  ];

  return (
    <CrudTable
      title={t("expenses.log")}
      titleEn={t("expenses.kicker")}
      data={expenses}
      columns={columns}
      isLoading={isLoading}
      searchKey="descriptionAr"
      onAdd={() => alert(t("expenses.addSoon"))}
    />
  );
}
