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

export interface ExpenseTypeRow {
  id: number;
  name: string;
  notes?: string | null;
  createdAt?: string;
}

export interface UpsertExpenseTypeBody {
  name: string;
  notes?: string;
}

export interface ExpenseRow {
  id: number;
  invoiceNo: string;
  description: string;
  descriptionAr?: string | null;
  notes?: string | null;
  amount: number;
  category: string;
  expenseTypeId?: number | null;
  expenseTypeName?: string;
  expenseDate: string;
  date: string;
  employeeId?: number | null;
  branchId?: number | null;
  branchName?: string;
  createdAt?: string;
}

export interface UpsertExpenseBody {
  invoiceNo?: string;
  expenseTypeId: number;
  amount: number;
  expenseDate: string;
  notes?: string;
  description?: string;
  descriptionAr?: string;
  branchId?: number | null;
  employeeId?: number | null;
}

export interface ListExpensesParams {
  from?: string;
  to?: string;
  expenseTypeId?: number;
  filterBranchId?: number;
  invoiceNo?: string;
}

const base = "/api/expenses";

function qs(params?: ListExpensesParams) {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.expenseTypeId && params.expenseTypeId > 0) {
    sp.set("expenseTypeId", String(params.expenseTypeId));
  }
  if (params.filterBranchId && params.filterBranchId > 0) {
    sp.set("filterBranchId", String(params.filterBranchId));
  }
  if (params.invoiceNo?.trim()) sp.set("invoiceNo", params.invoiceNo.trim());
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getGetExpenseTypesQueryKey = () => [`${base}/types`] as const;
export const getListExpensesQueryKey = (params?: ListExpensesParams) =>
  [base, "list", params ?? {}] as const;

export const getExpenseTypes = (options?: RequestOpts) =>
  customFetch<ExpenseTypeRow[]>(`${base}/types`, { ...options, method: "GET" });

export const listExpenses = (params?: ListExpensesParams, options?: RequestOpts) =>
  customFetch<ExpenseRow[]>(`${base}${qs(params)}`, { ...options, method: "GET" });

export function useGetExpenseTypes(options?: {
  query?: Partial<UseQueryOptions<ExpenseTypeRow[], ErrorType<unknown>, ExpenseTypeRow[]>>;
  request?: RequestOpts;
}) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetExpenseTypesQueryKey();
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getExpenseTypes({ signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<ExpenseTypeRow[], ErrorType<unknown>, ExpenseTypeRow[]> & {
    queryKey: QueryKey;
  });
}

export function useListExpenses(
  params?: ListExpensesParams,
  options?: {
    query?: Partial<UseQueryOptions<ExpenseRow[], ErrorType<unknown>, ExpenseRow[]>>;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getListExpensesQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => listExpenses(params, { signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<ExpenseRow[], ErrorType<unknown>, ExpenseRow[]> & {
    queryKey: QueryKey;
  });
}

export function useCreateExpenseType(
  options?: UseMutationOptions<
    ExpenseTypeRow,
    ErrorType<unknown>,
    BodyType<UpsertExpenseTypeBody>
  >
): UseMutationResult<ExpenseTypeRow, ErrorType<unknown>, BodyType<UpsertExpenseTypeBody>> {
  return useMutation({
    mutationFn: (body) =>
      customFetch<ExpenseTypeRow>(`${base}/types`, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useUpdateExpenseType(
  options?: UseMutationOptions<
    ExpenseTypeRow,
    ErrorType<unknown>,
    { id: number; data: BodyType<UpsertExpenseTypeBody> }
  >
) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      customFetch<ExpenseTypeRow>(`${base}/types/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useDeleteExpenseType(
  options?: UseMutationOptions<{ ok: boolean }, ErrorType<unknown>, number>
) {
  return useMutation({
    mutationFn: (id) =>
      customFetch<{ ok: boolean }>(`${base}/types/${id}`, { method: "DELETE" }),
    ...options,
  });
}

export function useCreateExpenseEntry(
  options?: UseMutationOptions<ExpenseRow, ErrorType<unknown>, BodyType<UpsertExpenseBody>>
): UseMutationResult<ExpenseRow, ErrorType<unknown>, BodyType<UpsertExpenseBody>> {
  return useMutation({
    mutationFn: (body) =>
      customFetch<ExpenseRow>(base, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useUpdateExpenseEntry(
  options?: UseMutationOptions<
    ExpenseRow,
    ErrorType<unknown>,
    { id: number; data: BodyType<UpsertExpenseBody> }
  >
) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      customFetch<ExpenseRow>(`${base}/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    ...options,
  });
}

export function useDeleteExpenseEntry(
  options?: UseMutationOptions<{ ok: boolean }, ErrorType<unknown>, number>
) {
  return useMutation({
    mutationFn: (id) =>
      customFetch<{ ok: boolean }>(`${base}/${id}`, { method: "DELETE" }),
    ...options,
  });
}
