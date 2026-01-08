import { http } from './http'
import type {
  Resource,
  ResourceSearchOptions,
  ResourceCreateInput,
  ResourceUpdateInput,
} from './types'

type GetInput = string | { id: string }

async function list(): Promise<Resource[]> {
  return http.get<Resource[]>('/resources')
}

async function get(input: GetInput): Promise<Resource> {
  if (typeof input === 'string') {
    // Treat string as URL
    return http.get<Resource>('/resources', { url: input })
  }
  // Get by ID
  return http.get<Resource>(`/resources/${input.id}`)
}

async function search(options: ResourceSearchOptions = {}): Promise<Resource[]> {
  const params: Record<string, string | number | undefined> = {}

  if (options.query) params['q'] = options.query
  if (options.category) params['category'] = options.category
  if (options.minSuccessRate !== undefined) params['min_success_rate'] = options.minSuccessRate
  if (options.minCalls !== undefined) params['min_calls'] = options.minCalls
  if (options.limit !== undefined) params['limit'] = options.limit
  if (options.offset !== undefined) params['offset'] = options.offset

  return http.get<Resource[]>('/resources/search', params)
}

async function register(input: ResourceCreateInput): Promise<Resource> {
  return http.post<Resource>('/resources', input)
}

async function update(id: string, input: ResourceUpdateInput): Promise<Resource> {
  return http.patch<Resource>(`/resources/${id}`, input)
}

async function remove(id: string): Promise<void> {
  await http.delete(`/resources/${id}`)
}

export const resources = {
  list,
  get,
  search,
  register,
  update,
  delete: remove,
}
