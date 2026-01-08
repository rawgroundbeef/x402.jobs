import { getConfig } from './config'
import { X402Error } from './errors'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

function buildUrl(path: string, params?: RequestOptions['params']): string {
  const { baseUrl } = getConfig()
  const url = new URL(path, baseUrl)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value))
      }
    }
  }

  return url.toString()
}

function getHeaders(): Record<string, string> {
  const { apiKey } = getConfig()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }

  return headers
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type')

  if (!contentType?.includes('application/json')) {
    if (!response.ok) {
      throw X402Error.fromStatus(response.status, response.statusText)
    }
    return undefined as T
  }

  const data = (await response.json()) as { error?: { code?: string; message?: string } } | T

  if (!response.ok) {
    const errorData = data as { error?: { code?: string; message?: string } }
    const message = errorData?.error?.message ?? response.statusText
    throw X402Error.fromStatus(response.status, message)
  }

  return data as T
}

export async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, params } = options
  const url = buildUrl(path, params)
  const headers = getHeaders()

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body)
  }

  const response = await fetch(url, fetchOptions)
  return parseResponse<T>(response)
}

export const http = {
  get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return request<T>(path, { method: 'GET', params })
  },

  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'POST', body })
  },

  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', body })
  },

  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
}
