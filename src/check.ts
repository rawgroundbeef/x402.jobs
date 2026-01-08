import { http } from './http'
import type { Score, TopOptions } from './types'

async function checkUrl(url: string): Promise<Score> {
  return http.get<Score>('/resources/score', { url })
}

async function checkMany(urls: string[]): Promise<Score[]> {
  // Phase 2: Use batch endpoint when available
  // For now, run checks in parallel
  return Promise.all(urls.map((url) => checkUrl(url)))
}

async function checkExists(url: string): Promise<boolean> {
  const result = await http.get<{ exists: boolean }>('/resources/exists', { url })
  return result.exists
}

async function checkTop(options: TopOptions = {}): Promise<Score[]> {
  const { limit = 20, category } = options
  return http.get<Score[]>('/resources/top', { limit, category })
}

// Create the check function with additional methods attached
type CheckFunction = typeof checkUrl & {
  many: typeof checkMany
  exists: typeof checkExists
  top: typeof checkTop
}

export const check: CheckFunction = Object.assign(checkUrl, {
  many: checkMany,
  exists: checkExists,
  top: checkTop,
})
