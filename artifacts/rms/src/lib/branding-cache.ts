/** Instant brand paint from localStorage while API refetches. */

export type LoginBrand = {
  restaurantName: string;
  logoUrl: string;
};

export type HomeBrand = {
  branchId: number | "all" | null;
  name: string;
  logoUrl: string;
};

const LOGIN_BRAND_KEY = "rms-login-brand";
const HOME_BRAND_KEY = "rms-home-brand";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function readLoginBrandCache(): LoginBrand | null {
  try {
    const parsed = safeParse<LoginBrand>(localStorage.getItem(LOGIN_BRAND_KEY));
    if (!parsed) return null;
    const restaurantName = String(parsed.restaurantName ?? "").trim();
    const logoUrl = String(parsed.logoUrl ?? "").trim();
    if (!restaurantName && !logoUrl) return null;
    return { restaurantName, logoUrl };
  } catch {
    return null;
  }
}

export function writeLoginBrandCache(brand: {
  restaurantName?: string | null;
  logoUrl?: string | null;
}) {
  const restaurantName = String(brand.restaurantName ?? "").trim();
  const logoUrl = String(brand.logoUrl ?? "").trim();
  if (!restaurantName && !logoUrl) return;
  try {
    localStorage.setItem(
      LOGIN_BRAND_KEY,
      JSON.stringify({ restaurantName, logoUrl } satisfies LoginBrand)
    );
  } catch {
    /* private mode / quota */
  }
}

export function readHomeBrandCache(): HomeBrand | null {
  try {
    const parsed = safeParse<HomeBrand>(localStorage.getItem(HOME_BRAND_KEY));
    if (!parsed) return null;
    const name = String(parsed.name ?? "").trim();
    const logoUrl = String(parsed.logoUrl ?? "").trim();
    if (!name && !logoUrl) return null;
    return {
      branchId: parsed.branchId ?? null,
      name,
      logoUrl,
    };
  } catch {
    return null;
  }
}

export function writeHomeBrandCache(brand: {
  branchId: number | "all" | null;
  name?: string | null;
  logoUrl?: string | null;
}) {
  const name = String(brand.name ?? "").trim();
  const logoUrl = String(brand.logoUrl ?? "").trim();
  if (!name && !logoUrl) return;
  try {
    localStorage.setItem(
      HOME_BRAND_KEY,
      JSON.stringify({
        branchId: brand.branchId,
        name,
        logoUrl,
      } satisfies HomeBrand)
    );
  } catch {
    /* private mode / quota */
  }
}
