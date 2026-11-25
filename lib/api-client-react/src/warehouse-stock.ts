import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
  type QueryKey,
  type QueryFunction,
} from "@tanstack/react-query";
import { customFetch, type ErrorType, type CustomFetchOptions } from "./custom-fetch";

type RequestOpts = CustomFetchOptions;

export interface WarehouseStockRow {
  menuItemId: number;
  code: string;
  name: string;
  nameAr: string;
  categoryId: number;
  categoryName: string;
  categoryNameAr: string;
  majorUnit: string | null;
  minorUnit: string;
  subunitQty: number;
  costPerMinor: number;
  purchasedMinor: number;
  returnedMinor: number;
  soldMinor: number;
  remainingMinor: number;
  remainingMajor: number;
  remainingMinorPart: number;
  remainingLabel: string;
  totalCost: number;
}

export interface WarehouseMovementLine {
  id: number;
  date: string;
  time?: string | null;
  docNo: string;
  qty: number;
  unitKind: "major" | "minor" | "sale";
  unitLabel: string;
  qtyMinor: number;
  amount?: number;
  note?: string | null;
}

export interface WarehouseItemDetail {
  item: WarehouseStockRow;
  purchases: WarehouseMovementLine[];
  returns: WarehouseMovementLine[];
  sales: WarehouseMovementLine[];
  totals: {
    purchasedMinor: number;
    returnedMinor: number;
    soldMinor: number;
    remainingMinor: number;
    remainingLabel: string;
  };
}

export const getGetWarehouseStockUrl = () => `/api/inventory/stock`;
export const getGetWarehouseStockQueryKey = () => [`/api/inventory/stock`] as const;

export const getWarehouseStock = async (
  options?: RequestOpts
): Promise<WarehouseStockRow[]> => {
  return customFetch<WarehouseStockRow[]>(getGetWarehouseStockUrl(), {
    ...options,
    method: "GET",
  });
};

export function useGetWarehouseStock<
  TData = Awaited<ReturnType<typeof getWarehouseStock>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<
    UseQueryOptions<Awaited<ReturnType<typeof getWarehouseStock>>, TError, TData>
  >;
  request?: RequestOpts;
}) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetWarehouseStockQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getWarehouseStock>>> = ({
    signal,
  }) => getWarehouseStock({ signal, ...requestOptions });
  const query = useQuery({ queryKey, queryFn, ...queryOptions }) as UseQueryResult<
    TData,
    TError
  > & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const getGetWarehouseItemDetailUrl = (
  menuItemId: number,
  params?: { from?: string; to?: string }
) => {
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  const q = qs.toString();
  return `/api/inventory/stock/${menuItemId}${q ? `?${q}` : ""}`;
};

export const getGetWarehouseItemDetailQueryKey = (
  menuItemId: number,
  params?: { from?: string; to?: string }
) => [`/api/inventory/stock`, menuItemId, params?.from ?? "", params?.to ?? ""] as const;

export const getWarehouseItemDetail = async (
  menuItemId: number,
  params?: { from?: string; to?: string },
  options?: RequestOpts
): Promise<WarehouseItemDetail> => {
  return customFetch<WarehouseItemDetail>(
    getGetWarehouseItemDetailUrl(menuItemId, params),
    { ...options, method: "GET" }
  );
};

export function useGetWarehouseItemDetail<
  TData = Awaited<ReturnType<typeof getWarehouseItemDetail>>,
  TError = ErrorType<unknown>,
>(
  menuItemId: number | null | undefined,
  params?: { from?: string; to?: string },
  options?: {
    query?: Partial<
      UseQueryOptions<Awaited<ReturnType<typeof getWarehouseItemDetail>>, TError, TData>
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const id = menuItemId ?? 0;
  const queryKey =
    queryOptions?.queryKey ?? getGetWarehouseItemDetailQueryKey(id, params);
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getWarehouseItemDetail>>> = ({
    signal,
  }) => getWarehouseItemDetail(id, params, { signal, ...requestOptions });
  const query = useQuery({
    queryKey,
    queryFn,
    enabled: id > 0 && (queryOptions?.enabled ?? true),
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}
