import type { HttpClient } from './http'
import type {
  Resource,
  ResourceListOptions,
  ResourceSearchOptions,
  ResourceCreateInput,
  ResourceUpdateInput,
} from './types'

type GetInput = string | { id: string }

export class ResourcesAPI {
  constructor(private http: HttpClient) {}

  async list(options: ResourceListOptions = {}): Promise<Resource[]> {
    const params: Record<string, string | number | undefined> = {}
    if (options.limit !== undefined) params['limit'] = options.limit
    if (options.sort) params['sort'] = options.sort
    const response = await this.http.get<{ resources: Resource[] }>('/resources', params)
    return response.resources
  }

  async get(input: GetInput): Promise<Resource> {
    if (typeof input === 'string') {
      return this.http.get<Resource>('/resources', { url: input })
    }
    return this.http.get<Resource>(`/resources/${input.id}`)
  }

  async search(options: ResourceSearchOptions = {}): Promise<Resource[]> {
    const params: Record<string, string | number | undefined> = {}

    if (options.query) params['q'] = options.query
    if (options.category) params['category'] = options.category
    if (options.minSuccessRate !== undefined) params['min_success_rate'] = options.minSuccessRate
    if (options.minCalls !== undefined) params['min_calls'] = options.minCalls
    if (options.limit !== undefined) params['limit'] = options.limit
    if (options.offset !== undefined) params['offset'] = options.offset

    return this.http.get<Resource[]>('/resources/search', params)
  }

  async register(input: ResourceCreateInput): Promise<Resource> {
    return this.http.post<Resource>('/resources', input)
  }

  async update(id: string, input: ResourceUpdateInput): Promise<Resource> {
    return this.http.patch<Resource>(`/resources/${id}`, input)
  }

  async delete(id: string): Promise<void> {
    await this.http.delete(`/resources/${id}`)
  }
}
