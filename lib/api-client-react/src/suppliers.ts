import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type QueryKey,
  type QueryFunction,
} from "@tanstack/react-query";
import {
  customFetch,
  type BodyType,
  type ErrorType,
  type CustomFetchOptions,
} from "./custom-fetch";

type RequestOpts = CustomFetchOptions;

export type SupplierAmountType = "paid" | "received" | "discount";
export type SupplierUnitKind = "major" | "minor";

export interface Supplier {
  id: number;
  code: string;
  name: string;
  openingBalance: number;
  balance?: number;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertSupplierBody {
  code: string;
  name: string;
  openingBalance?: number;
  notes?: string;
}

export interface SupplierPurchaseItem {
  id?: number;
  menuItemId: number;
  qty: number;
  unitKind: SupplierUnitKind;
  unitLabel: string;
  price: number;
  amount: number;
  itemNameAr?: string | null;
  itemName?: string | null;
  majorUnit?: string | null;
  minorUnit?: string | null;
  subunitQty?: number | null;
}

export interface SupplierPurchase {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  invoiceTime: string;
  supplierId: number;
  supplierCode?: string;
  supplierName?: string;
  notes?: string | null;
  totalQty: number;
  totalAmount: number;
  items: SupplierPurchaseItem[];
  createdAt?: string;
}

export interface CreateSupplierPurchaseBody {
  invoiceNo: string;
  invoiceDate: string;
  invoiceTime: string;
  supplierId: number;
  notes?: string;
  items: Array<{
    menuItemId: number;
    qty: number;
    unitKind: SupplierUnitKind;
    price: number;
  }>;
}

export interface SupplierMovement {
  id: number;
  invoiceNo: string;
  movementDate: string;
  movementTime: string;
  supplierId: number;
  supplierCode?: string;
  supplierName?: string;
  amountType: SupplierAmountType;
  amount: number;
  notes?: string | null;
  createdAt?: string;
}

export interface CreateSupplierMovementBody {
  invoiceNo: string;
  movementDate: string;
  movementTime: string;
  supplierId: number;
  amountType: SupplierAmountType;
  amount: number;
  notes?: string;
}

export interface SupplierStatementLine {
  id: string;
  kind: "opening" | "purchase" | "movement";
  date: string;
  time: string;
  invoiceNo: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface SupplierStatement {
  supplier: Supplier;
  balance: number;
  balanceLabel: string;
  lines: SupplierStatementLine[];
}

export interface SupplierDebtItem {
  id: number;
  code: string;
  name: string;
  balance: number;
  label: string;
}

export interface SupplierDebtsReport {
  items: SupplierDebtItem[];
  totalOwedByUs: number;
  totalOwedToUs: number;
}

const base = "/api/suppliers";

export const getGetSuppliersQueryKey = () => [base] as const;
export const getGetSupplierPurchasesQueryKey = () => [`${base}/purchases`] as const;
export const getGetSupplierMovementsQueryKey = () => [`${base}/movements`] as const;
export const getGetSupplierDebtsQueryKey = () => [`${base}/debts`] as const;
export const getGetSupplierStatementQueryKey = (supplierId: number) =>
  [`${base}/statement`, supplierId] as const;

export const getSuppliers = (options?: RequestOpts) =>
  customFetch<Supplier[]>(base, { ...options, method: "GET" });

export const getSupplierPurchases = (options?: RequestOpts) =>
  customFetch<SupplierPurchase[]>(`${base}/purchases`, { ...options, method: "GET" });

export const getSupplierMovements = (options?: RequestOpts) =>
  customFetch<SupplierMovement[]>(`${base}/movements`, { ...options, method: "GET" });

export const getSupplierDebts = (options?: RequestOpts) =>
  customFetch<SupplierDebtsReport>(`${base}/debts`, { ...options, method: "GET" });

export const getSupplierStatement = (supplierId: number, options?: RequestOpts) =>
  customFetch<SupplierStatement>(`${base}/statement/${supplierId}`, {
    ...options,
    method: "GET",
  });

function useListQuery<T>(
  key: QueryKey,
  fetcher: (opts?: RequestOpts) => Promise<T>,
  options?: {
    query?: Partial<UseQueryOptions<T, ErrorType<unknown>, T>>;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? key;
  const queryFn: QueryFunction<T> = ({ signal }) =>
    fetcher({ signal, ...requestOptions });
  return useQuery({ queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    T,
    ErrorType<unknown>,
    T
  > & { queryKey: QueryKey });
}

export function useGetSuppliers(options?: {
  query?: Partial<UseQueryOptions<Supplier[], ErrorType<unknown>, Supplier[]>>;
  request?: RequestOpts;
}) {
  return useListQuery(getGetSuppliersQueryKey(), getSuppliers, options);
}

export function useGetSupplierPurchases(options?: {
  query?: Partial<
    UseQueryOptions<SupplierPurchase[], ErrorType<unknown>, SupplierPurchase[]>
  >;
  request?: RequestOpts;
}) {
  return useListQuery(getGetSupplierPurchasesQueryKey(), getSupplierPurchases, options);
}

export function useGetSupplierMovements(options?: {
  query?: Partial<
    UseQueryOptions<SupplierMovement[], ErrorType<unknown>, SupplierMovement[]>
  >;
  request?: RequestOpts;
}) {
  return useListQuery(getGetSupplierMovementsQueryKey(), getSupplierMovements, options);
}

export function useGetSupplierDebts(options?: {
  query?: Partial<
    UseQueryOptions<SupplierDebtsReport, ErrorType<unknown>, SupplierDebtsReport>
  >;
  request?: RequestOpts;
}) {
  return useListQuery(getGetSupplierDebtsQueryKey(), getSupplierDebts, options);
}

export function useGetSupplierStatement(
  supplierId: number,
  options?: {
    query?: Partial<
      UseQueryOptions<SupplierStatement, ErrorType<unknown>, SupplierStatement>
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetSupplierStatementQueryKey(supplierId);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      getSupplierStatement(supplierId, { signal, ...requestOptions }),
    enabled: supplierId > 0,
    ...queryOptions,
  });
}

export function useCreateSupplier(
  options?: UseMutationOptions<Supplier, ErrorType<unknown>, BodyType<UpsertSupplierBody>>
): UseMutationResult<Supplier, ErrorType<unknown>, BodyType<UpsertSupplierBody>> {
  return useMutation({
    mutationFn: (body) =>
      customFetch<Supplier>(base, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }),
    ...options,
  });
}

export function useUpdateSupplier(
  options?: UseMutationOptions<
    Supplier,
    ErrorType<unknown>,
    { id: number; data: BodyType<UpsertSupplierBody> }
  >
) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      customFetch<Supplier>(`${base}/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useDeleteSupplier(
  options?: UseMutationOptions<{ ok: boolean }, ErrorType<unknown>, { id: number }>
) {
  return useMutation({
    mutationFn: ({ id }) =>
      customFetch<{ ok: boolean }>(`${base}/${id}`, { method: "DELETE" }),
    ...options,
  });
}

export function useCreateSupplierPurchase(
  options?: UseMutationOptions<
    SupplierPurchase,
    ErrorType<unknown>,
    BodyType<CreateSupplierPurchaseBody>
  >
) {
  return useMutation({
    mutationFn: (body) =>
      customFetch<SupplierPurchase>(`${base}/purchases`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useDeleteSupplierPurchase(
  options?: UseMutationOptions<{ ok: boolean }, ErrorType<unknown>, { id: number }>
) {
  return useMutation({
    mutationFn: ({ id }) =>
      customFetch<{ ok: boolean }>(`${base}/purchases/${id}`, { method: "DELETE" }),
    ...options,
  });
}

export function useCreateSupplierMovement(
  options?: UseMutationOptions<
    SupplierMovement,
    ErrorType<unknown>,
    BodyType<CreateSupplierMovementBody>
  >
) {
  return useMutation({
    mutationFn: (body) =>
      customFetch<SupplierMovement>(`${base}/movements`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useDeleteSupplierMovement(
  options?: UseMutationOptions<{ ok: boolean }, ErrorType<unknown>, { id: number }>
) {
  return useMutation({
    mutationFn: ({ id }) =>
      customFetch<{ ok: boolean }>(`${base}/movements/${id}`, { method: "DELETE" }),
    ...options,
  });
}
