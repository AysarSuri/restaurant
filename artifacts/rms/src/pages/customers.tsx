import React from "react";
import { useGetCustomers } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Customer } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Customers() {
  const { data: customers, isLoading } = useGetCustomers();

  const columns = [
    { key: "name", header: "اسم العميل" },
    { key: "phone", header: "رقم الهاتف", render: (item: Customer) => <span className="font-display">{item.phone || '-'}</span> },
    { key: "totalOrders", header: "عدد الطلبات", render: (item: Customer) => <span className="font-display font-bold">{item.totalOrders || 0}</span> },
    { key: "loyaltyPoints", header: "النقاط", render: (item: Customer) => <span className="font-display text-primary font-bold">{item.loyaltyPoints || 0}</span> }
  ];

  return (
    <CrudTable 
      title="قاعدة العملاء" 
      titleEn="Customers CRM" 
      data={customers} 
      columns={columns} 
      isLoading={isLoading}
      searchKey="name"
    />
  );
}
