import React from "react";
import { useGetExpenses } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Expense } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Expenses() {
  const { data: expenses, isLoading } = useGetExpenses();

  const columns = [
    { key: "descriptionAr", header: "البيان" },
    { key: "category", header: "التصنيف" },
    { key: "amount", header: "المبلغ", render: (item: Expense) => <span className="font-display font-bold text-destructive">{new Intl.NumberFormat('en-IQ').format(item.amount)} د.ع</span> },
    { key: "date", header: "التاريخ", render: (item: Expense) => <span className="font-display">{new Date(item.date).toLocaleDateString()}</span> }
  ];

  return (
    <CrudTable 
      title="سجل المصاريف" 
      titleEn="Expenses" 
      data={expenses} 
      columns={columns} 
      isLoading={isLoading}
      searchKey="descriptionAr"
      onAdd={() => alert("سيتم إضافة نموذج المصروف")}
    />
  );
}
