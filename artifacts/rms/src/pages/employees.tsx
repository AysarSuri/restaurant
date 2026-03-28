import React from "react";
import { useGetEmployees } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Badge } from "@/components/ui-elements";
import { Employee } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Employees() {
  const { data: employees, isLoading } = useGetEmployees();

  const columns = [
    { key: "name", header: "اسم الموظف" },
    { key: "role", header: "المنصب", render: (item: Employee) => <Badge variant="outline">{item.role}</Badge> },
    { key: "phone", header: "رقم الهاتف", render: (item: Employee) => <span className="font-display">{item.phone || '-'}</span> },
    { key: "isActive", header: "الحالة", render: (item: Employee) => (
      <Badge variant={item.isActive ? "success" : "destructive"}>{item.isActive ? "نشط" : "موقوف"}</Badge>
    )}
  ];

  return (
    <CrudTable 
      title="إدارة الموظفين" 
      titleEn="Employees" 
      data={employees} 
      columns={columns} 
      isLoading={isLoading}
      searchKey="name"
    />
  );
}
