import { X402Error } from './errors'
import type { ClientOptions } from './types'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

interface RequestOptions {
  method?: HttpMethod
  body?: unknown
  params?: Record<string, string | number | boolean | undefined>
}

const DEFAULT_BASE_URL = 'https://x402.jobs/api/v1'

export class HttpClient {
  private baseUrl: string
  private apiKey: string | undefined

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
    this.apiKey = options.apiKey
  }

  private buildUrl(path: string, params?: RequestOptions['params']): string {
    const url = new URL(path, this.baseUrl)

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value))
        }
      }
    }

    return url.toString()
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    return headers
  }

  private async parseResponse<T>(response: Response): Promise<T> {
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

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params } = options
    const url = this.buildUrl(path, params)
    const headers = this.getHeaders()

    const fetchOptions: RequestInit = {
      method,
      headers,
    }

    if (body !== undefined) {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await fetch(url, fetchOptions)
    return this.parseResponse<T>(response)
  }

  get<T>(path: string, params?: RequestOptions['params']): Promise<T> {
    return this.request<T>(path, { method: 'GET', params })
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body })
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body })
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' })
  }
}
