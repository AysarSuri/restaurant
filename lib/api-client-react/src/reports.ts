import {
  useQuery,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import {
  customFetch,
  type ErrorType,
  type CustomFetchOptions,
} from "./custom-fetch";

type RequestOpts = CustomFetchOptions;

export type SalesBreakdownGroupBy = "date" | "item" | "category";

export interface SalesBreakdownRow {
  key: string;
  label: string;
  labelAr: string;
  qty: number;
  amount: number;
  orderCount: number;
  lineCount: number;
}

export interface SalesBreakdownSummary {
  totalQty: number;
  totalAmount: number;
  orderCount: number;
  lineCount: number;
  rowCount: number;
}

export interface SalesBreakdownResponse {
  from: string;
  to: string;
  groupBy: SalesBreakdownGroupBy;
  branchId: number | null;
  categoryId: number | null;
  menuItemId: number | null;
  summary: SalesBreakdownSummary;
  rows: SalesBreakdownRow[];
}

export interface SalesBreakdownParams {
  from?: string;
  to?: string;
  groupBy?: SalesBreakdownGroupBy;
  filterBranchId?: number;
  categoryId?: number;
  menuItemId?: number;
}

const base = "/api/reports/sales-breakdown";

function qs(params?: SalesBreakdownParams) {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.groupBy) sp.set("groupBy", params.groupBy);
  if (params.filterBranchId && params.filterBranchId > 0) {
    sp.set("filterBranchId", String(params.filterBranchId));
  }
  if (params.categoryId && params.categoryId > 0) {
    sp.set("categoryId", String(params.categoryId));
  }
  if (params.menuItemId && params.menuItemId > 0) {
    sp.set("menuItemId", String(params.menuItemId));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getSalesBreakdownQueryKey = (params?: SalesBreakdownParams) =>
  [base, params ?? {}] as const;

export const getSalesBreakdown = (
  params?: SalesBreakdownParams,
  options?: RequestOpts
) =>
  customFetch<SalesBreakdownResponse>(`${base}${qs(params)}`, {
    ...options,
    method: "GET",
  });

export function useGetSalesBreakdown(
  params?: SalesBreakdownParams,
  options?: {
    query?: Partial<
      UseQueryOptions<
        SalesBreakdownResponse,
        ErrorType<unknown>,
        SalesBreakdownResponse
      >
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getSalesBreakdownQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getSalesBreakdown(params, { signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<
    SalesBreakdownResponse,
    ErrorType<unknown>,
    SalesBreakdownResponse
  > & { queryKey: QueryKey });
}

export interface SalesProfitRow {
  id: number;
  orderId: number;
  invoiceNo: string;
  date: string;
  time: string;
  menuItemId: number;
  itemName: string;
  itemNameAr: string;
  categoryId: number;
  categoryName: string;
  categoryNameAr: string;
  qty: number;
  unitPrice: number;
  costPrice: number;
  lineSale: number;
  lineCost: number;
  profit: number;
}

export interface SalesProfitSummary {
  lineCount: number;
  totalQty: number;
  totalSale: number;
  totalCost: number;
  totalProfit: number;
  orderCount: number;
}

export interface SalesProfitResponse {
  from: string;
  to: string;
  branchId: number | null;
  categoryId: number | null;
  menuItemId: number | null;
  summary: SalesProfitSummary;
  rows: SalesProfitRow[];
}

export interface SalesProfitParams {
  from?: string;
  to?: string;
  filterBranchId?: number;
  categoryId?: number;
  menuItemId?: number;
}

const profitBase = "/api/reports/sales-profit";

function profitQs(params?: SalesProfitParams) {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.filterBranchId && params.filterBranchId > 0) {
    sp.set("filterBranchId", String(params.filterBranchId));
  }
  if (params.categoryId && params.categoryId > 0) {
    sp.set("categoryId", String(params.categoryId));
  }
  if (params.menuItemId && params.menuItemId > 0) {
    sp.set("menuItemId", String(params.menuItemId));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getSalesProfitQueryKey = (params?: SalesProfitParams) =>
  [profitBase, params ?? {}] as const;

export const getSalesProfit = (
  params?: SalesProfitParams,
  options?: RequestOpts
) =>
  customFetch<SalesProfitResponse>(`${profitBase}${profitQs(params)}`, {
    ...options,
    method: "GET",
  });

export function useGetSalesProfit(
  params?: SalesProfitParams,
  options?: {
    query?: Partial<
      UseQueryOptions<
        SalesProfitResponse,
        ErrorType<unknown>,
        SalesProfitResponse
      >
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getSalesProfitQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getSalesProfit(params, { signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<
    SalesProfitResponse,
    ErrorType<unknown>,
    SalesProfitResponse
  > & { queryKey: QueryKey });
}

export interface SalesDiscountRow {
  id: number;
  invoiceNo: string;
  date: string;
  time: string;
  discount: number;
  subtotal: number;
  total: number;
  paymentMethod?: string | null;
  type?: string | null;
}

export interface SalesDiscountSummary {
  invoiceCount: number;
  totalDiscount: number;
  totalSales: number;
}

export interface SalesDiscountResponse {
  from: string;
  to: string;
  branchId: number | null;
  summary: SalesDiscountSummary;
  rows: SalesDiscountRow[];
}

export interface SalesDiscountParams {
  from?: string;
  to?: string;
  filterBranchId?: number;
}

const discountBase = "/api/reports/sales-discounts";

function discountQs(params?: SalesDiscountParams) {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.filterBranchId && params.filterBranchId > 0) {
    sp.set("filterBranchId", String(params.filterBranchId));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getSalesDiscountsQueryKey = (params?: SalesDiscountParams) =>
  [discountBase, params ?? {}] as const;

export const getSalesDiscounts = (
  params?: SalesDiscountParams,
  options?: RequestOpts
) =>
  customFetch<SalesDiscountResponse>(`${discountBase}${discountQs(params)}`, {
    ...options,
    method: "GET",
  });

export function useGetSalesDiscounts(
  params?: SalesDiscountParams,
  options?: {
    query?: Partial<
      UseQueryOptions<
        SalesDiscountResponse,
        ErrorType<unknown>,
        SalesDiscountResponse
      >
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getSalesDiscountsQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getSalesDiscounts(params, { signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<
    SalesDiscountResponse,
    ErrorType<unknown>,
    SalesDiscountResponse
  > & { queryKey: QueryKey });
}
