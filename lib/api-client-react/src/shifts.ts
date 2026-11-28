import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseMutationResult,
  type UseQueryOptions,
  type UseQueryResult,
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

export type ShiftKind = "morning" | "evening";

export interface Shift {
  id: number;
  kind: ShiftKind;
  name: string;
  branchId: number;
  branchName?: string | null;
  color: string;
  openedAt: string;
  closedAt?: string | null;
  openDate: string;
  startTime: string;
  endTime?: string | null;
  notes?: string | null;
  isActive: boolean;
  isOpen: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface OpenShiftBody {
  kind: ShiftKind;
  branchId: number;
  /** YYYY-MM-DD or ISO datetime — defaults to now */
  openedAt?: string;
  notes?: string | null;
  /** Device that opens the shift stays logged in; others are force-logged out */
  deviceKey?: string | null;
}

export interface UpdateShiftBody {
  notes?: string | null;
  close?: boolean;
  closedAt?: string | null;
}

export const getGetShiftsUrl = () => `/api/shifts`;

export const getShifts = async (options?: RequestOpts): Promise<Shift[]> => {
  return customFetch<Shift[]>(getGetShiftsUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetShiftsQueryKey = () => [`/api/shifts`] as const;

export const getGetShiftsQueryOptions = <
  TData = Awaited<ReturnType<typeof getShifts>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getShifts>>, TError, TData>>;
  request?: RequestOpts;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetShiftsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getShifts>>> = ({
    signal,
  }) => getShifts({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getShifts>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetShifts<
  TData = Awaited<ReturnType<typeof getShifts>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getShifts>>, TError, TData>>;
  request?: RequestOpts;
}) {
  const queryOptions = getGetShiftsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const createShift = async (
  body: OpenShiftBody,
  options?: RequestOpts
): Promise<Shift> => {
  return customFetch<Shift>(getGetShiftsUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useCreateShift = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createShift>>,
    TError,
    { data: BodyType<OpenShiftBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof createShift>>,
  TError,
  { data: BodyType<OpenShiftBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["createShift"],
    ...mutationOptions,
    mutationFn: ({ data }) => createShift(data, requestOptions),
  });
};

export const updateShift = async (
  id: number,
  body: UpdateShiftBody,
  options?: RequestOpts
): Promise<Shift> => {
  return customFetch<Shift>(`/api/shifts/${id}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateShift = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateShift>>,
    TError,
    { id: number; data: BodyType<UpdateShiftBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateShift>>,
  TError,
  { id: number; data: BodyType<UpdateShiftBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateShift"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateShift(id, data, requestOptions),
  });
};

export const closeShift = async (
  id: number,
  options?: RequestOpts
): Promise<Shift> => {
  return customFetch<Shift>(`/api/shifts/${id}/close`, {
    ...options,
    method: "POST",
  });
};

export const useCloseShift = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof closeShift>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof closeShift>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["closeShift"],
    ...mutationOptions,
    mutationFn: ({ id }) => closeShift(id, requestOptions),
  });
};

export const deleteShift = async (
  id: number,
  options?: RequestOpts
): Promise<{ success: boolean; message?: string }> => {
  return customFetch<{ success: boolean; message?: string }>(`/api/shifts/${id}`, {
    ...options,
    method: "DELETE",
  });
};

export const useDeleteShift = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteShift>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteShift>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["deleteShift"],
    ...mutationOptions,
    mutationFn: ({ id }) => deleteShift(id, requestOptions),
  });
};

export interface ShiftReportCategory {
  categoryId: number;
  name: string;
  amount: number;
  qty: number;
}

export interface ShiftReportLine {
  id: number;
  invoiceNo?: string | null;
  label?: string;
  amount?: number;
  notes?: string | null;
  date?: string | null;
  time?: string | null;
  totalAmount?: number;
  paidAmount?: number;
  receivedAmount?: number;
  discountAmount?: number;
}

export interface ShiftReport {
  shift: Shift;
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  branchName: string;
  branchAddress?: string | null;
  openedAt: string;
  closedAt?: string | null;
  sales: {
    byCategory: ShiftReportCategory[];
    total: number;
    discountTotal: number;
    receivedTotal: number;
    invoiceCount: number;
    /** Open-shift only: غير واصل (incl. carryover from previous shifts) */
    unpaidTotal?: number;
    unpaidCount?: number;
  };
  expenses: {
    total: number;
    items: ShiftReportLine[];
  };
  cashMovements: {
    show: boolean;
    withdrawalsTotal: number;
    returnsTotal: number;
    withdrawals: ShiftReportLine[];
    returns: ShiftReportLine[];
  };
  suppliers: {
    show: boolean;
    purchasesTotal: number;
    returnsTotal: number;
    paidTotal: number;
    receivedTotal: number;
    discountTotal: number;
    purchases: ShiftReportLine[];
    returns: ShiftReportLine[];
  };
}

export const getShiftReport = async (
  id: number,
  options?: RequestOpts
): Promise<ShiftReport> => {
  return customFetch<ShiftReport>(`/api/shifts/${id}/report`, {
    ...options,
    method: "GET",
  });
};

export const getGetShiftReportQueryKey = (id: number) =>
  [`/api/shifts/${id}/report`] as const;

export function useGetShiftReport<
  TData = Awaited<ReturnType<typeof getShiftReport>>,
  TError = ErrorType<unknown>,
>(
  id: number | null | undefined,
  options?: {
    query?: Partial<
      UseQueryOptions<Awaited<ReturnType<typeof getShiftReport>>, TError, TData>
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const enabled =
    id != null &&
    Number.isFinite(id) &&
    (queryOptions?.enabled === undefined ? true : Boolean(queryOptions.enabled));
  const queryKey = queryOptions?.queryKey ?? getGetShiftReportQueryKey(Number(id || 0));
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getShiftReport>>> = ({
    signal,
  }) => getShiftReport(Number(id), { signal, ...requestOptions });
  const query = useQuery({
    ...queryOptions,
    queryKey,
    queryFn,
    enabled,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}
