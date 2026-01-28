import { HttpClient } from './http'
import { createCheckAPI, type CheckAPI } from './check'
import { ResourcesAPI } from './resources'
import type { ClientOptions } from './types'

export class X402Jobs {
  readonly check: CheckAPI
  readonly resources: ResourcesAPI

  constructor(options: ClientOptions = {}) {
    const http = new HttpClient(options)
    this.check = createCheckAPI(http)
    this.resources = new ResourcesAPI(http)
  }
}
