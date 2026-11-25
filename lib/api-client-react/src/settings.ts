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

export type PosSaveTarget = "kitchen" | "none";

export interface AppSettings {
  restaurantName: string;
  logoUrl?: string | null;
  mobile?: string | null;
  themePrimary: string;
  currencyCode: string;
  currencySymbol: string;
  currencyName: string;
  decimalPlaces: number;
  /** POS/table save destination: kitchen | none (save only) */
  posSaveTarget: PosSaveTarget;
  /** Cashier payment confirmation sends order to kitchen */
  cashierSendToKitchen: boolean;
  /** Flat delivery fee for delivery orders */
  deliveryFee?: number;
  /** Require driver on delivery orders */
  deliveryRequireDriver?: boolean;
  /** Require mobile phone on delivery orders */
  deliveryRequirePhone?: boolean;
  /** Require address on delivery orders */
  deliveryRequireAddress?: boolean;
  updatedAt?: string;
}

export interface UpdateAppSettingsBody {
  restaurantName?: string;
  logoUrl?: string | null;
  mobile?: string | null;
  themePrimary?: string;
  currencyCode?: string;
  currencySymbol?: string;
  currencyName?: string;
  decimalPlaces?: number;
  posSaveTarget?: PosSaveTarget;
  cashierSendToKitchen?: boolean;
  deliveryFee?: number;
  deliveryRequireDriver?: boolean;
  deliveryRequirePhone?: boolean;
  deliveryRequireAddress?: boolean;
}

export type DeviceSalesPaymentAt = "pos" | "cashier";

export interface DevicePrinter {
  id: number;
  branchId?: number | null;
  branchName?: string | null;
  deviceKey: string;
  deviceName: string;
  printerName: string;
  paperSize: string;
  isActive: boolean;
  note?: string | null;
  /** Legacy / fallback collect payment on POS or cashier */
  salesPaymentAt?: DeviceSalesPaymentAt;
  /** Table (dine-in) payment source */
  salesPaymentAtDineIn?: DeviceSalesPaymentAt;
  /** Takeaway payment source */
  salesPaymentAtTakeaway?: DeviceSalesPaymentAt;
  /** Delivery payment source */
  salesPaymentAtDelivery?: DeviceSalesPaymentAt;
  /** Independent kitchen send for this device */
  salesSendToKitchen?: boolean;
  /** All app forms in browser fullscreen on this device */
  formsFullscreen?: boolean;
  /** On-screen numeric keypad for amount/price fields on this device */
  virtualNumericKeypad?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertDevicePrinterBody {
  deviceKey: string;
  deviceName: string;
  printerName?: string;
  branchId?: number | null;
  note?: string;
  isActive?: boolean;
  salesPaymentAt?: DeviceSalesPaymentAt;
  salesPaymentAtDineIn?: DeviceSalesPaymentAt;
  salesPaymentAtTakeaway?: DeviceSalesPaymentAt;
  salesPaymentAtDelivery?: DeviceSalesPaymentAt;
  salesSendToKitchen?: boolean;
  formsFullscreen?: boolean;
  virtualNumericKeypad?: boolean;
}

export interface UpdateDevicePrinterBody {
  deviceName?: string;
  printerName?: string;
  branchId?: number | null;
  note?: string;
  isActive?: boolean;
  salesPaymentAt?: DeviceSalesPaymentAt;
  salesPaymentAtDineIn?: DeviceSalesPaymentAt;
  salesPaymentAtTakeaway?: DeviceSalesPaymentAt;
  salesPaymentAtDelivery?: DeviceSalesPaymentAt;
  salesSendToKitchen?: boolean;
  formsFullscreen?: boolean;
  virtualNumericKeypad?: boolean;
}

export const getGetSettingsUrl = () => `/api/settings`;
export const getGetSettingsQueryKey = () => [`/api/settings`] as const;

export const getSettings = async (options?: RequestOpts): Promise<AppSettings> => {
  return customFetch<AppSettings>(getGetSettingsUrl(), { ...options, method: "GET" });
};

export const getGetSettingsQueryOptions = <
  TData = Awaited<ReturnType<typeof getSettings>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>>;
  request?: RequestOpts;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetSettingsQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getSettings>>> = ({ signal }) =>
    getSettings({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getSettings>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetSettings<
  TData = Awaited<ReturnType<typeof getSettings>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>>;
  request?: RequestOpts;
}) {
  const queryOptions = getGetSettingsQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const updateSettings = async (
  body: UpdateAppSettingsBody,
  options?: RequestOpts
): Promise<AppSettings> => {
  return customFetch<AppSettings>(getGetSettingsUrl(), {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateSettings = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateSettings>>,
    TError,
    { data: BodyType<UpdateAppSettingsBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateSettings>>,
  TError,
  { data: BodyType<UpdateAppSettingsBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateSettings"],
    ...mutationOptions,
    mutationFn: ({ data }) => updateSettings(data, requestOptions),
  });
};

export const getGetDevicePrintersUrl = () => `/api/settings/printers`;
export const getGetDevicePrintersQueryKey = () => [`/api/settings/printers`] as const;

export const getDevicePrinters = async (options?: RequestOpts): Promise<DevicePrinter[]> => {
  return customFetch<DevicePrinter[]>(getGetDevicePrintersUrl(), { ...options, method: "GET" });
};

export const getGetDevicePrintersQueryOptions = <
  TData = Awaited<ReturnType<typeof getDevicePrinters>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getDevicePrinters>>, TError, TData>>;
  request?: RequestOpts;
}) => {
  const { query: queryOptions, request: requestOptions } = options ?? {};
  const queryKey = queryOptions?.queryKey ?? getGetDevicePrintersQueryKey();
  const queryFn: QueryFunction<Awaited<ReturnType<typeof getDevicePrinters>>> = ({ signal }) =>
    getDevicePrinters({ signal, ...requestOptions });
  return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
    Awaited<ReturnType<typeof getDevicePrinters>>,
    TError,
    TData
  > & { queryKey: QueryKey };
};

export function useGetDevicePrinters<
  TData = Awaited<ReturnType<typeof getDevicePrinters>>,
  TError = ErrorType<unknown>,
>(options?: {
  query?: Partial<UseQueryOptions<Awaited<ReturnType<typeof getDevicePrinters>>, TError, TData>>;
  request?: RequestOpts;
}) {
  const queryOptions = getGetDevicePrintersQueryOptions(options);
  const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & { queryKey: QueryKey };
  return { ...query, queryKey: queryOptions.queryKey };
}

export const upsertDevicePrinter = async (
  body: UpsertDevicePrinterBody,
  options?: RequestOpts
): Promise<DevicePrinter> => {
  return customFetch<DevicePrinter>(getGetDevicePrintersUrl(), {
    ...options,
    method: "POST",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpsertDevicePrinter = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof upsertDevicePrinter>>,
    TError,
    { data: BodyType<UpsertDevicePrinterBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof upsertDevicePrinter>>,
  TError,
  { data: BodyType<UpsertDevicePrinterBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["upsertDevicePrinter"],
    ...mutationOptions,
    mutationFn: ({ data }) => upsertDevicePrinter(data, requestOptions),
  });
};

export const updateDevicePrinter = async (
  id: number,
  body: UpdateDevicePrinterBody,
  options?: RequestOpts
): Promise<DevicePrinter> => {
  return customFetch<DevicePrinter>(`/api/settings/printers/${id}`, {
    ...options,
    method: "PUT",
    headers: { "Content-Type": "application/json", ...options?.headers },
    body: JSON.stringify(body),
  });
};

export const useUpdateDevicePrinter = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof updateDevicePrinter>>,
    TError,
    { id: number; data: BodyType<UpdateDevicePrinterBody> },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof updateDevicePrinter>>,
  TError,
  { id: number; data: BodyType<UpdateDevicePrinterBody> },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["updateDevicePrinter"],
    ...mutationOptions,
    mutationFn: ({ id, data }) => updateDevicePrinter(id, data, requestOptions),
  });
};

export const deleteDevicePrinter = async (
  id: number,
  options?: RequestOpts
): Promise<{ success: boolean; message?: string }> => {
  return customFetch<{ success: boolean; message?: string }>(`/api/settings/printers/${id}`, {
    ...options,
    method: "DELETE",
  });
};

export const useDeleteDevicePrinter = <TError = ErrorType<unknown>, TContext = unknown>(options?: {
  mutation?: UseMutationOptions<
    Awaited<ReturnType<typeof deleteDevicePrinter>>,
    TError,
    { id: number },
    TContext
  >;
  request?: RequestOpts;
}): UseMutationResult<
  Awaited<ReturnType<typeof deleteDevicePrinter>>,
  TError,
  { id: number },
  TContext
> => {
  const { mutation: mutationOptions, request: requestOptions } = options ?? {};
  return useMutation({
    mutationKey: ["deleteDevicePrinter"],
    ...mutationOptions,
    mutationFn: ({ id }) => deleteDevicePrinter(id, requestOptions),
  });
};
