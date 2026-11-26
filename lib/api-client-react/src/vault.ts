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

export interface VaultLedgerLine {
  id: string;
  date: string;
  time?: string | null;
  source: string;
  sourceAr: string;
  label: string;
  invoiceNo?: string | null;
  debit: number;
  credit: number;
  signed: number;
  balanceAfter?: number;
  paymentMethod: "cash" | "card";
  cardId: number | null;
  cardName?: string | null;
  branchId?: number | null;
}

export interface VaultAccountStatement {
  key: string;
  kind: "cash" | "card";
  titleAr: string;
  cardId: number | null;
  openingBalance: number;
  openingBeforeFrom: number;
  periodDebit: number;
  periodCredit: number;
  periodNet: number;
  closingBalance: number;
  lines: VaultLedgerLine[];
}

export interface VaultStatementResponse {
  from: string;
  to: string;
  openingAsOf: string;
  cashOpeningBalance: number;
  branchId: number | null;
  accounts: VaultAccountStatement[];
}

export interface VaultStatementParams {
  from?: string;
  to?: string;
  filterBranchId?: number;
}

const base = "/api/vault";

function qs(params?: VaultStatementParams) {
  if (!params) return "";
  const sp = new URLSearchParams();
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.filterBranchId && params.filterBranchId > 0) {
    sp.set("filterBranchId", String(params.filterBranchId));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export const getVaultStatementQueryKey = (params?: VaultStatementParams) =>
  [base, "statement", params ?? {}] as const;

export const getVaultStatement = (
  params?: VaultStatementParams,
  options?: RequestOpts
) =>
  customFetch<VaultStatementResponse>(`${base}/statement${qs(params)}`, {
    ...options,
    method: "GET",
  });

export function useGetVaultStatement(
  params?: VaultStatementParams,
  options?: {
    query?: Partial<
      UseQueryOptions<VaultStatementResponse, ErrorType<unknown>, VaultStatementResponse>
    >;
    request?: RequestOpts;
  }
) {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getVaultStatementQueryKey(params);
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => getVaultStatement(params, { signal, ...requestOptions }),
    ...queryOptions,
  } as UseQueryOptions<VaultStatementResponse, ErrorType<unknown>, VaultStatementResponse> & {
    queryKey: QueryKey;
  });
}

export const setVaultCashOpening = async (
  cashOpeningBalance: number,
  options?: RequestOpts
) =>
  customFetch<{ cashOpeningBalance: number }>(`${base}/cash-opening`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify({ cashOpeningBalance }),
  });

export function useSetVaultCashOpening(
  options?: UseMutationOptions<
    { cashOpeningBalance: number },
    ErrorType<unknown>,
    BodyType<{ cashOpeningBalance: number }>
  >
): UseMutationResult<
  { cashOpeningBalance: number },
  ErrorType<unknown>,
  BodyType<{ cashOpeningBalance: number }>
> {
  return useMutation({
    mutationKey: ["setVaultCashOpening"],
    mutationFn: (data) => setVaultCashOpening(Number(data.cashOpeningBalance)),
    ...options,
  });
}
