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

export interface DriverStats {
  orderCount: number;
  invoiceCount: number;
  invoiceAmount: number;
  deliveryAmount: number;
  grandTotal: number;
}

export interface Driver extends DriverStats {
  id: number;
  name: string;
  phone?: string | null;
  vehicleInfo?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  isActive: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DriversListResponse {
  drivers: Driver[];
  totals: DriverStats;
  filters: {
    date: string | null;
    branchId: number | null;
    shiftId: number | null;
    driverId: number | null;
  };
}

export interface UpsertDriverBody {
  name: string;
  phone?: string | null;
  vehicleInfo?: string | null;
  branchId?: number | null;
  notes?: string | null;
  isActive?: boolean;
}

export interface GetDriversParams {
  search?: string;
  date?: string;
  branchId?: number | "";
  shiftId?: number | "";
  driverId?: number | "";
}

export const getGetDriversUrl = () => `/api/drivers`;
export const getGetDriversQueryKey = (params?: GetDriversParams) =>
  [`/api/drivers`, params ?? {}] as const;

function buildDriversQs(params?: GetDriversParams) {
  const qs = new URLSearchParams();
  if (params?.search?.trim()) qs.set("search", params.search.trim());
  if (params?.date?.trim()) qs.set("date", params.date.trim());
  if (params?.branchId != null && params.branchId !== "") {
    qs.set("branchId", String(params.branchId));
  }
  if (params?.shiftId != null && params.shiftId !== "") {
    qs.set("shiftId", String(params.shiftId));
  }
  if (params?.driverId != null && params.driverId !== "") {
    qs.set("driverId", String(params.driverId));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const getDrivers = async (
  params?: GetDriversParams,
  options?: RequestOpts
): Promise<DriversListResponse> => {
  return customFetch<DriversListResponse>(`${getGetDriversUrl()}${buildDriversQs(params)}`, {
    ...options,
    method: "GET",
  });
};

export const getGetDriversQueryOptions = <
  TData = Awaited<ReturnType<typeof getDrivers>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getDrivers>>, TError, TData>>;
  request?: RequestOpts;
  params?: GetDriversParams;
}) => {
  const { query: queryOptions, request: requestOptions, params } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetDriversQueryKey(params);
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getDrivers>>> = ({ signal }) =>
    getDrivers(params, { signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getDrivers>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetDrivers<
  TData = Awaited<ReturnType<typeof getDrivers>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getDrivers>>, TError, TData>>;
  request?: RequestOpts;
  params?: GetDriversParams;
}) {
  const queryOptions = getGetDriversQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const createDriver = async (
  body: UpsertDriverBody,
  options?: RequestOpts
): Promise<Driver> => {
  return customFetch<Driver>(getGetDriversUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useCreateDriver = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createDriver>>,
    TError,
    { data: BodyType<UpsertDriverBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof createDriver>>,
  TError,
  { data: BodyType<UpsertDriverBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["createDriver"],
    ...mutationOptions,
    mutationFn: ({ data }) => createDriver(data, requestOptions),
  });
};

export const updateDriver = async (
  id: number,
  body: UpsertDriverBody,
  options?: RequestOpts
): Promise<Driver> => {
  return customFetch<Driver>(`${getGetDriversUrl()}/${id}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateDriver = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateDriver>>,
    TError,
    { id: number; data: BodyType<UpsertDriverBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateDriver>>,
  TError,
  { id: number; data: BodyType<UpsertDriverBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateDriver"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateDriver(id, data, requestOptions),
  });
};

export const deleteDriver = async (
  id: number,
  options?: RequestOpts
): Promise<{ success: boolean; message?: string }> => {
  return customFetch<{ success: boolean; message?: string }>(`${getGetDriversUrl()}/${id}`, {
    ...options,
    method: "DELETE",
  });
};

export const useDeleteDriver = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteDriver>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteDriver>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["deleteDriver"],
    ...mutationOptions,
    mutationFn: ({ id }) => deleteDriver(id, requestOptions),
  });
};
