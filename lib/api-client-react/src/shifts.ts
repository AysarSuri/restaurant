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

export interface Shift {
  id: number;
  name: string;
  nameAr?: string | null;
  code?: string | null;
  branchId: number;
  branchName?: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  daysOfWeek: number[];
  color: string;
  supervisorEmployeeId?: number | null;
  supervisorName?: string | null;
  notes?: string | null;
  isActive: boolean;
  employeeIds: number[];
  employeeNames?: string[];
  durationMinutes: number;
  workMinutes: number;
  isOvernight?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertShiftBody {
  name: string;
  nameAr?: string;
  code?: string;
  branchId: number;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  graceMinutes?: number;
  daysOfWeek?: number[];
  color?: string;
  supervisorEmployeeId?: number | null;
  notes?: string;
  isActive?: boolean;
  employeeIds?: number[];
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
  body: UpsertShiftBody,
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
    { data: BodyType<UpsertShiftBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof createShift>>,
  TError,
  { data: BodyType<UpsertShiftBody> },
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
  body: UpsertShiftBody,
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
    { id: number; data: BodyType<UpsertShiftBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateShift>>,
  TError,
  { id: number; data: BodyType<UpsertShiftBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateShift"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateShift(id, data, requestOptions),
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
