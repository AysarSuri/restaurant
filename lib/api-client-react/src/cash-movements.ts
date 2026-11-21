import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import {
  customFetch,
  type BodyType,
  type ErrorType,
  type CustomFetchOptions,
} from "./custom-fetch";

type RequestOpts = CustomFetchOptions;

export type CashMovementKind = "withdrawal" | "return";

export interface CashMovementRow {
  id: number;
  invoiceNo: string;
  movementDate: string;
  movementTime: string;
  kind: CashMovementKind;
  amount: number;
  notes?: string | null;
  branchId?: number | null;
  branchName?: string;
  createdAt?: string;
}

export interface UpsertCashMovementBody {
  invoiceNo?: string;
  movementDate: string;
  movementTime: string;
  kind: CashMovementKind;
  amount: number;
  notes?: string;
  branchId?: number | null;
}

export interface ListCashMovementsParams {
  from?: string;
  to?: string;
  kind?: CashMovementKind | "";
  invoiceNo?: string;
  filterBranchId?: number;
}

const base = "/api/cash-movements";

function qs(params?: ListCashMovementsParams) {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.kind) sp.set("kind", params.kind);
  if (params.filterBranchId && params.filterBranchId > 0) {
    sp.set("filterBranchId", String(params.filterBranchId));
  }
  if (params.invoiceNo?.trim()) sp.set("invoiceNo", params.invoiceNo.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getListCashMovementsQueryKey = (params?: ListCashMovementsParams) =>
  [base, "list", params ?? {}] as const;

export const listCashMovements = (
  params?: ListCashMovementsParams,
  options?: RequestOpts
) => customFetch<CashMovementRow[]>(`${base}${qs(params)}`, { ...options, method: "GET" });

export function useListCashMovements(
  params?: ListCashMovementsParams,
  options?: {
    query?: Partial<
      UseQueryOptions<CashMovementRow[], ErrorType<unknown>, CashMovementRow[]>
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getListCashMovementsQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => listCashMovements(params, { signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<CashMovementRow[], ErrorType<unknown>, CashMovementRow[]> & {
    queryKey: QueryKey;
  });
}

export function useCreateCashMovement(
  options?: UseMutationOptions<
    CashMovementRow,
    ErrorType<unknown>,
    BodyType<UpsertCashMovementBody>
  >
): UseMutationResult<CashMovementRow, ErrorType<unknown>, BodyType<UpsertCashMovementBody>> {
  return useMutation({
    mutationFn: (body) =>
      customFetch<CashMovementRow>(base, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useUpdateCashMovement(
  options?: UseMutationOptions<
    CashMovementRow,
    ErrorType<unknown>,
    { id: number; data: BodyType<UpsertCashMovementBody> }
  >
) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      customFetch<CashMovementRow>(`${base}/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useDeleteCashMovement(
  options?: UseMutationOptions<{ ok: boolean }, ErrorType<unknown>, number>
) {
  return useMutation({
    mutationFn: (id) =>
      customFetch<{ ok: boolean }>(`${base}/${id}`, { method: "DELETE" }),
    ...options,
  });
}
