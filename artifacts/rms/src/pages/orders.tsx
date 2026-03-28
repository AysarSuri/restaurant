import React from "react";
import { useGetOrders } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Badge } from "@/components/ui-elements";
import { Order } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Orders() {
  const { data: orders, isLoading } = useGetOrders();

  const columns = [
    { key: "orderNumber", header: "رقم الطلب", render: (item: Order) => <span className="font-display font-bold text-primary">#{item.orderNumber.slice(-6)}</span> },
    { key: "type", header: "النوع", render: (item: Order) => item.type === 'dine_in' ? 'طاولة' : item.type === 'takeaway' ? 'سفري' : 'توصيل' },
    { key: "total", header: "الإجمالي", render: (item: Order) => <span className="font-display font-bold">{new Intl.NumberFormat('en-IQ').format(item.total)} د.ع</span> },
    { key: "status", header: "الحالة", render: (item: Order) => (
      <Badge variant={item.status === 'paid' ? 'success' : item.status === 'cancelled' ? 'destructive' : 'warning'}>
        {item.status}
      </Badge>
    )},
    { key: "createdAt", header: "الوقت", render: (item: Order) => <span className="font-display">{new Date(item.createdAt).toLocaleString()}</span> }
  ];

  return (
    <CrudTable 
      title="سجل الطلبات" 
      titleEn="Orders History" 
      data={orders} 
      columns={columns} 
      isLoading={isLoading}
      searchKey="orderNumber"
    />
  );
}
