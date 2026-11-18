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
import type { CreateItemUnitBody, ItemUnit } from "./generated/api.schemas";

type RequestOpts = CustomFetchOptions;

export const getGetItemUnitsUrl = () => `/api/menu/units`;

export const getItemUnits = async (options?: RequestOpts): Promise<ItemUnit[]> => {
  return customFetch<ItemUnit[]>(getGetItemUnitsUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetItemUnitsQueryKey = () => [`/api/menu/units`] as const;

export function useGetItemUnits<
  TData = Awaited<ReturnType<typeof getItemUnits>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getItemUnits>>, TError, TData>>;
  request?: RequestOpts;
}) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetItemUnitsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getItemUnits>>> = ({
    signal,
  }) => getItemUnits({ signal, ...requestOptions });
  const query = useQuery({
    queryKey,
    queryFn,
    ...queryOptions,
  }) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey };
}

export const createItemUnit = async (
  body: CreateItemUnitBody,
  options?: RequestOpts
): Promise<ItemUnit> => {
  return customFetch<ItemUnit>(getGetItemUnitsUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useCreateItemUnit = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createItemUnit>>,
    TError,
    { data: BodyType<CreateItemUnitBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof createItemUnit>>,
  TError,
  { data: BodyType<CreateItemUnitBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["createItemUnit"],
    ...mutationOptions,
    mutationFn: ({ data }) => createItemUnit(data, requestOptions),
  });
};
