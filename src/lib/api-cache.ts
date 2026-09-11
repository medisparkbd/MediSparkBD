import { NextResponse } from "next/server";

/**
 * Cache header presets for different route types
 */
export const CACHE_HEADERS = {
  // Static assets - 1 year, immutable
  STATIC: {
    "Cache-Control": "public, max-age=31536000, immutable",
  },
  // API responses that change frequently - 5s with stale-while-revalidate
  API_SHORT: {
    "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
  },
  // API responses that change moderately - 30s
  API_MEDIUM: {
    "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
  },
  // API responses that change infrequently - 5min
  API_LONG: {
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
  },
  // No cache - for mutations and user-specific data
  NO_CACHE: {
    "Cache-Control": "no-store, must-revalidate",
  },
  // Private user data - no shared cache
  PRIVATE: {
    "Cache-Control": "private, max-age=0, must-revalidate",
  },
} as const;

export function withCache<T extends NextResponse>(
  response: T,
  preset: keyof typeof CACHE_HEADERS = "API_MEDIUM"
): T {
  const headers = CACHE_HEADERS[preset];
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Create a cached JSON response with proper headers
 */
export function cachedJson<T>(
  data: T,
  preset: keyof typeof CACHE_HEADERS = "API_MEDIUM",
  init?: { status?: number; statusText?: string }
): NextResponse {
  const response = NextResponse.json(data, { status: init?.status, statusText: init?.statusText });
  return withCache(response, preset);
}

/**
 * Create an error response with no-cache headers
 */
export function errorResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: CACHE_HEADERS.NO_CACHE });
}