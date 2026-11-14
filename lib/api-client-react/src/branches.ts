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

export interface Branch {
  id: number;
  name: string;
  mobile1: string;
  mobile2?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  isActive: boolean;
  note?: string | null;
  createdAt?: string;
}

export interface CreateBranchBody {
  name: string;
  mobile1: string;
  mobile2?: string;
  address?: string;
  logoUrl?: string;
  isActive?: boolean;
  note?: string;
}

type RequestOpts = CustomFetchOptions;

export const getGetBranchesUrl = () => `/api/branches`;

export const getBranches = async (options?: RequestOpts): Promise<Branch[]> => {
  return customFetch<Branch[]>(getGetBranchesUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetBranchesQueryKey = () => [`/api/branches`] as const;

export const getGetBranchesQueryOptions = <
  TData = Awaited<ReturnType<typeof getBranches>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getBranches>>, TError, TData>>;
  request?: RequestOpts;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetBranchesQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getBranches>>> = ({ signal }) =>
    getBranches({ signal, ...requestOptions });

  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getBranches>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetBranches<
  TData = Awaited<ReturnType<typeof getBranches>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getBranches>>, TError, TData>>;
  request?: RequestOpts;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
  const queryOptions = getGetBranchesQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
  };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const createBranch = async (
  body: CreateBranchBody,
  options?: RequestOpts
): Promise<Branch> => {
  return customFetch<Branch>(getGetBranchesUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useCreateBranch = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof createBranch>>,
    TError,
    { data: BodyType<CreateBranchBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof createBranch>>,
  TError,
  { data: BodyType<CreateBranchBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["createBranch"],
    ...mutationOptions,
    mutationFn: ({ data }) => createBranch(data, requestOptions),
  });
};

export const updateBranch = async (
  id: number,
  body: CreateBranchBody,
  options?: RequestOpts
): Promise<Branch> => {
  return customFetch<Branch>(`/api/branches/${id}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateBranch = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateBranch>>,
    TError,
    { id: number; data: BodyType<CreateBranchBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateBranch>>,
  TError,
  { id: number; data: BodyType<CreateBranchBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateBranch"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateBranch(id, data, requestOptions),
  });
};

export const deleteBranch = async (
  id: number,
  options?: RequestOpts
): Promise<{ success: boolean; message?: string }> => {
  return customFetch<{ success: boolean; message?: string }>(`/api/branches/${id}`, {
    ...options,
    method: "DELETE",
  });
};

export const useDeleteBranch = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteBranch>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteBranch>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["deleteBranch"],
    ...mutationOptions,
    mutationFn: ({ id }) => deleteBranch(id, requestOptions),
  });
};
