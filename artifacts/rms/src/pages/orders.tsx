import React, { useMemo } from "react";
import { useGetOrders, useGetBranches, type Order } from "@workspace/api-client-react";
import { CrudTable } from "@/components/crud-table";
import { Badge } from "@/components/ui-elements";
import { BranchSwitcher } from "@/components/branch-switcher";
import { useBranch } from "@/lib/branch-context";
import { useI18n } from "@/i18n";

export default function Orders() {
  const { t, formatDateTime } = useI18n();
  const { selectedBranchId, branchLabel } = useBranch();
  const { data: branches } = useGetBranches();

  const { data: orders, isLoading } = useGetOrders(undefined, {
    query: {
      queryKey: ["/api/orders", "log", selectedBranchId],
      staleTime: 1_500,
      refetchOnWindowFocus: true,
    },
  });

  const branchNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of branches ?? []) {
      map.set(b.id, b.nameAr?.trim() || b.name || String(b.id));
    }
    return map;
  }, [branches]);

  const filteredOrders = useMemo(() => {
    const list = orders ?? [];
    if (selectedBranchId === "all") return list;
    return list.filter((o) => o.branchId === selectedBranchId);
  }, [orders, selectedBranchId]);

  const columns = useMemo(() => {
    const cols: {
      key: string;
      header: string;
      render: (item: Order) => React.ReactNode;
    }[] = [
      {
        key: "orderNumber",
        header: t("orders.number"),
        render: (item: Order) => (
          <span className="font-display font-bold text-primary">
            #{item.orderNumber.slice(-6)}
          </span>
        ),
      },
      {
        key: "type",
        header: t("common.type"),
        render: (item: Order) =>
          item.type === "dine_in"
            ? t("order.dineIn")
            : item.type === "takeaway"
              ? t("order.takeaway")
              : t("order.delivery"),
      },
      {
        key: "total",
        header: t("common.total"),
        render: (item: Order) => (
          <span className="font-display font-bold">
            {new Intl.NumberFormat("en-IQ").format(item.total)} {t("common.iqd")}
          </span>
        ),
      },
      {
        key: "status",
        header: t("common.status"),
        render: (item: Order) => (
          <Badge
            variant={
              item.status === "paid"
                ? "success"
                : item.status === "cancelled"
                  ? "destructive"
                  : "warning"
            }
          >
            {item.status}
          </Badge>
        ),
      },
      {
        key: "createdAt",
        header: t("common.time"),
        render: (item: Order) => (
          <span className="font-display tabular-nums" dir="ltr">
            {formatDateTime(item.createdAt)}
          </span>
        ),
      },
    ];

    if (selectedBranchId === "all") {
      cols.splice(1, 0, {
        key: "branch",
        header: t("common.branch"),
        render: (item: Order) => (
          <span className="font-semibold text-muted-foreground">
            {item.branchId != null
              ? branchNameById.get(item.branchId) || String(item.branchId)
              : t("branch.none")}
          </span>
        ),
      });
    }

    return cols;
  }, [t, formatDateTime, selectedBranchId, branchNameById]);

  return (
    <CrudTable
      title={t("orders.log")}
      titleEn={`${t("orders.kicker")} · ${branchLabel}`}
      data={filteredOrders}
      columns={columns}
      isLoading={isLoading}
      searchKey="orderNumber"
      headerActions={<BranchSwitcher />}
    />
  );
}
