import type { HttpClient } from './http'
import type { Score, TopOptions } from './types'

export interface CheckAPI {
  (url: string): Promise<Score>
  many(urls: string[]): Promise<Score[]>
  exists(url: string): Promise<boolean>
  top(options?: TopOptions): Promise<Score[]>
}

export function createCheckAPI(http: HttpClient): CheckAPI {
  const check = async (url: string): Promise<Score> => {
    return http.get<Score>('/resources/score', { url })
  }

  check.many = async (urls: string[]): Promise<Score[]> => {
    return Promise.all(urls.map((url) => check(url)))
  }

  check.exists = async (url: string): Promise<boolean> => {
    const result = await http.get<{ exists: boolean }>('/resources/exists', { url })
    return result.exists
  }

  check.top = async (options: TopOptions = {}): Promise<Score[]> => {
    const { limit = 20, category } = options
    return http.get<Score[]>('/resources/top', { limit, category })
  }

  return check
}
