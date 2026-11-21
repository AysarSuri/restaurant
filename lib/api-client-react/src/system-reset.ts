import {
  useMutation,
  useQuery,
  type UseMutationOptions,
  type UseQueryOptions,
  type QueryFunction,
} from "@tanstack/react-query";
import {
  customFetch,
  type ErrorType,
  type CustomFetchOptions,
} from "./custom-fetch";

type RequestOpts = CustomFetchOptions;

export interface SystemResetGroup {
  key: string;
  labelAr: string;
  descriptionAr: string;
  tableCount: number;
  rowCount: number;
  seedsAdmin: boolean;
}

export interface SystemResetTablesResponse {
  groups: SystemResetGroup[];
  adminSeed: {
    name: string;
    role: string;
    note: string;
  };
}

export interface SystemResetResult {
  ok: boolean;
  key?: string;
  labelAr?: string;
  message: string;
  adminSeeded?: boolean;
  admin?: { id: number; name: string; role: string };
  clearedGroups?: string[];
}

export const getSystemResetTablesUrl = () => `/api/system-reset/tables`;

export const getSystemResetTables = async (
  options?: RequestOpts
): Promise<SystemResetTablesResponse> => {
  return customFetch<SystemResetTablesResponse>(getSystemResetTablesUrl(), {
    ...options,
    method: "GET",
  });
};

export const getGetSystemResetTablesQueryKey = () =>
  [`/api/system-reset/tables`] as const;

export function useGetSystemResetTables<
  TData = SystemResetTablesResponse,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<
    UseQueryOptions<SystemResetTablesResponse, TError, TData>
  >;
}) {
  const queryKey = getGetSystemResetTablesQueryKey();
  const queryFn: QueryFunction<SystemResetTablesResponse> = ({ signal }) =>
    getSystemResetTables({ signal });
  return useQuery({
    queryKey,
    queryFn,
    ...options?.query,
  });
}

export const resetSystemTable = async (
  key: string,
  options?: RequestOpts
): Promise<SystemResetResult> => {
  return customFetch<SystemResetResult>(`/api/system-reset/table/${key}`, {
    ...options,
    method: "POST",
  });
};

export const resetAllSystemTables = async (
  options?: RequestOpts
): Promise<SystemResetResult> => {
  return customFetch<SystemResetResult>(`/api/system-reset/all`, {
    ...options,
    method: "POST",
  });
};

export function useResetSystemTable(
  options?: UseMutationOptions<
    SystemResetResult,
    ErrorType<unknown>,
    string
  >
) {
  return useMutation({
    mutationFn: (key: string) => resetSystemTable(key),
    ...options,
  });
}

export function useResetAllSystemTables(
  options?: UseMutationOptions<
    SystemResetResult,
    ErrorType<unknown>,
    void
  >
) {
  return useMutation({
    mutationFn: () => resetAllSystemTables(),
    ...options,
  });
}
