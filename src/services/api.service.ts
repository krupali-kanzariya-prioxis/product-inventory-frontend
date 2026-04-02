import { API_BASE_URL } from "@/config/api.config";

let activeRequests = 0;
const listeners = new Set<(loading: boolean) => void>();

function notify() {
  const isLoading = activeRequests > 0;
  listeners.forEach((l) => l(isLoading));
}

export function subscribeLoading(listener: (loading: boolean) => void) {
  listeners.add(listener);
  listener(activeRequests > 0);
  return () => {
    listeners.delete(listener);
  };
}

function startRequest() {
  activeRequests += 1;
  notify();
}

function endRequest() {
  activeRequests = Math.max(0, activeRequests - 1);
  notify();
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  startRequest();
  try {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(errorBody || `HTTP ${response.status}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } finally {
    endRequest();
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "GET" });
}

export async function apiPost<T>(
  endpoint: string,
  body: unknown
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiRequest<T>(endpoint, { method: "DELETE" });
}

export function buildSearchParams(params: Record<string, unknown>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.append(key, String(value));
    }
  });
  return query.toString() ? `?${query.toString()}` : "";
}

export function getPageRecords<T>(data: unknown): T[] {
  const d = data as { result?: T[]; records?: T[]; Records?: T[] };
  // Try new API format first (result), then legacy formats
  return d.result ?? d.records ?? d.Records ?? [];
}

export function getPageTotal(data: unknown, fallbackLength = 0): number {
  const d = data as {
    meta?: { total_results?: number };
    totalRecords?: number;
    totalCount?: number;
    count?: number;
    TotalRecords?: number;
    TotalCount?: number;
    Count?: number;
    total_results?: number;
  };
  return (
    d.meta?.total_results ??
    d.totalRecords ??
    d.totalCount ??
    d.count ??
    d.total_results ??
    d.TotalRecords ??
    d.TotalCount ??
    d.Count ??
    fallbackLength
  );
}

export type FilterCondition = "=" | ">=" | ">" | "<=" | "<" | "in" | "nin" | "between";

export interface FilterParam {
  key: string;
  condition: FilterCondition;
  value: string;
  from?: string;
  to?: string;
}

export function buildListQuery(params: {
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortOrder?: "ASC" | "DESC";
  search?: string;
  filters?: FilterParam[];
}): string {
  const query = new URLSearchParams();
  query.set("page", String(params.page));
  query.set("pageSize", String(params.pageSize));

  if (params.sortColumn) query.set("sortColumn", params.sortColumn);
  if (params.sortOrder) query.set("sortOrder", params.sortOrder);
  if (params.search) {
    query.set("search", params.search);
    query.set("searchText", params.search);
    query.set("query", params.search);
  }
  if (params.filters && params.filters.length > 0) {
    query.set("Filters", JSON.stringify(params.filters));
  }

  return `?${query.toString()}`;
}
