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

export interface DeliveryContact {
  id: number;
  phone: string;
  address: string;
  name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gpsLabel?: string | null;
  note?: string | null;
  branchId?: number | null;
  branchName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertDeliveryContactBody {
  phone: string;
  address?: string;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  gpsLabel?: string;
  note?: string;
  branchId?: number | null;
}

export interface DeliveryPhoneLookup {
  found: boolean;
  contact: DeliveryContact | null;
}

export const getGetDeliveryContactsUrl = () => `/api/delivery-contacts`;
export const getGetDeliveryContactsQueryKey = () => [`/api/delivery-contacts`] as const;

export const getDeliveryContacts = async (
  params?: { search?: string },
  options?: RequestOpts
): Promise<DeliveryContact[]> => {
  const qs = params?.search ? `?search=${encodeURIComponent(params.search)}` : "";
  return customFetch<DeliveryContact[]>(`${getGetDeliveryContactsUrl()}${qs}`, {
    ...options,
    method: "GET",
  });
};

export const getGetDeliveryContactsQueryOptions = <
  TData = Awaited<ReturnType<typeof getDeliveryContacts>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<
    UseQueryOptions<Awaited<ReturnType<typeof getDeliveryContacts>>, TError, TData>
  >;
  request?: RequestOpts;
  search?: string;
}) => {
  const { query: queryOptions, request: requestOptions, search } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? [...getGetDeliveryContactsQueryKey(), search ?? ""];
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getDeliveryContacts>>> = ({
    signal,
  }) => getDeliveryContacts({ search }, { signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getDeliveryContacts>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetDeliveryContacts<
  TData = Awaited<ReturnType<typeof getDeliveryContacts>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<
    UseQueryOptions<Awaited<ReturnType<typeof getDeliveryContacts>>, TError, TData>
  >;
  request?: RequestOpts;
  search?: string;
}) {
  const queryOptions = getGetDeliveryContactsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const lookupDeliveryPhone = async (
  phone: string,
  options?: RequestOpts
): Promise<DeliveryPhoneLookup> => {
  return customFetch<DeliveryPhoneLookup>(
    `${getGetDeliveryContactsUrl()}/by-phone?phone=${encodeURIComponent(phone)}`,
    { ...options, method: "GET" }
  );
};

export const upsertDeliveryContact = async (
  body: UpsertDeliveryContactBody,
  options?: RequestOpts
): Promise<DeliveryContact> => {
  return customFetch<DeliveryContact>(getGetDeliveryContactsUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpsertDeliveryContact = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof upsertDeliveryContact>>,
    TError,
    { data: BodyType<UpsertDeliveryContactBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof upsertDeliveryContact>>,
  TError,
  { data: BodyType<UpsertDeliveryContactBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["upsertDeliveryContact"],
    ...mutationOptions,
    mutationFn: ({ data }) => upsertDeliveryContact(data, requestOptions),
  });
};

export const updateDeliveryContact = async (
  id: number,
  body: UpsertDeliveryContactBody,
  options?: RequestOpts
): Promise<DeliveryContact> => {
  return customFetch<DeliveryContact>(`${getGetDeliveryContactsUrl()}/${id}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateDeliveryContact = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateDeliveryContact>>,
    TError,
    { id: number; data: BodyType<UpsertDeliveryContactBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateDeliveryContact>>,
  TError,
  { id: number; data: BodyType<UpsertDeliveryContactBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateDeliveryContact"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateDeliveryContact(id, data, requestOptions),
  });
};

export const deleteDeliveryContact = async (
  id: number,
  options?: RequestOpts
): Promise<{ success: boolean; message?: string }> => {
  return customFetch<{ success: boolean; message?: string }>(
    `${getGetDeliveryContactsUrl()}/${id}`,
    { ...options, method: "DELETE" }
  );
};

export const useDeleteDeliveryContact = <
  TError = ErrorType<unknown>,
  TContext = unknown,
>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteDeliveryContact>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteDeliveryContact>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["deleteDeliveryContact"],
    ...mutationOptions,
    mutationFn: ({ id }) => deleteDeliveryContact(id, requestOptions),
  });
};
