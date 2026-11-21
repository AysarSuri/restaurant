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

export interface Card {
  id: number;
  name: string;
  openingBalance: number;
  balance: number;
  qrToken: string;
  note?: string | null;
  isActive: boolean;
  branchIds: number[];
  branchNames?: string[];
  createdAt?: string;
}

export interface CreateCardBody {
  name: string;
  openingBalance?: number;
  balance?: number;
  note?: string;
  isActive?: boolean;
  branchIds: number[];
}

export const getGetCardsUrl = () => `/api/cards`;

export const getCards = async (options?: RequestOpts): Promise<Card[]> => {
  return customFetch<Card[]>(getGetCardsUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetCardsQueryKey = () => [`/api/cards`] as const;

export const getGetCardsQueryOptions = <
  TData = Awaited<ReturnType<typeof getCards>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCards>>, TError, TData>>;
  request?: RequestOpts;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetCardsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getCards>>> = ({ signal }) =>
    getCards({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getCards>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetCards<
  TData = Awaited<ReturnType<typeof getCards>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getCards>>, TError, TData>>;
  request?: RequestOpts;
}) {
  const queryOptions = getGetCardsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const createCard = async (
  body: CreateCardBody,
  options?: RequestOpts
): Promise<Card> => {
  return customFetch<Card>(getGetCardsUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useCreateCard = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createCard>>,
    TError,
    { data: BodyType<CreateCardBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof createCard>>,
  TError,
  { data: BodyType<CreateCardBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["createCard"],
    ...mutationOptions,
    mutationFn: ({ data }) => createCard(data, requestOptions),
  });
};

export const updateCard = async (
  id: number,
  body: CreateCardBody,
  options?: RequestOpts
): Promise<Card> => {
  return customFetch<Card>(`/api/cards/${id}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateCard = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateCard>>,
    TError,
    { id: number; data: BodyType<CreateCardBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateCard>>,
  TError,
  { id: number; data: BodyType<CreateCardBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateCard"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateCard(id, data, requestOptions),
  });
};

export const deleteCard = async (
  id: number,
  options?: RequestOpts
): Promise<{ success: boolean; message?: string }> => {
  return customFetch<{ success: boolean; message?: string }>(`/api/cards/${id}`, {
    ...options,
    method: "DELETE",
  });
};

export const useDeleteCard = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteCard>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteCard>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["deleteCard"],
    ...mutationOptions,
    mutationFn: ({ id }) => deleteCard(id, requestOptions),
  });
};
