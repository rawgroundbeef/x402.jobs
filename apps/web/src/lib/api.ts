import { supabase } from "./supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3011";

/**
 * Get the current auth token from Supabase session
 */
async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Authenticated fetcher for SWR - automatically includes auth token
 */
export async function authenticatedFetcher<T>(url: string): Promise<T> {
  const token = await getAuthToken();

  const response = await fetch(
    url.startsWith("http") ? url : `${API_URL}${url}`,
    {
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Authenticated fetch for mutations (POST, PUT, DELETE)
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();

  return fetch(url.startsWith("http") ? url : `${API_URL}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });
}

/**
 * Public fetcher (no auth) for SWR
 */
export async function publicFetcher<T>(url: string): Promise<T> {
  const response = await fetch(
    url.startsWith("http") ? url : `${API_URL}${url}`,
    {
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export { API_URL };
