import http from 'http'
import https from 'https'
import { fetch } from 'ohmyfetch'
import { hasProtocol } from 'ufo'
import type { SourceFactory } from '../types'
import { createError, cachedPromise } from '../utils'

export interface HTTPSourceOptions {
  fetchOptions?: RequestInit
  maxAge?: number
  domains?: string | string[]
}

export const createHTTPSource: SourceFactory<HTTPSourceOptions> = (options) => {
  const httpsAgent = new https.Agent({ keepAlive: true })
  const httpAgent = new http.Agent({ keepAlive: true })

  let _domains = options.domains || []
  if (typeof _domains === 'string') {
    _domains = _domains.split(',').map(s => s.trim())
  }
  const domains = _domains.map((d) => {
    if (!hasProtocol(d)) { d = 'http://' + d }
    return new URL(d).hostname
  }).filter(Boolean)

  return async (id: string, reqOptions) => {
    // Check hostname
    const hostname = new URL(id).hostname
    if (!hostname) {
      throw createError('Hostname is missing', 403, id)
    }
    if (!reqOptions?.bypassDomain && !domains.find(domain => hostname === domain)) {
      throw createError('Forbidden host', 403, hostname)
    }

    const response = await fetch(id, {
      // @ts-ignore
      agent: id.startsWith('https') ? httpsAgent : httpAgent,
      ...options.fetchOptions
    })

    if (!response.ok) {
      throw createError('Fetch error', response.status || 500, response.statusText)
    }

    let maxAge = options.maxAge
    const _cacheControl = response.headers.get('cache-control')
    if (_cacheControl) {
      const m = _cacheControl.match(/max-age=(\d+)/)
      if (m && m[1]) {
        maxAge = parseInt(m[1])
      }
    }

    let mtime
    const _lastModified = response.headers.get('last-modified')
    if (_lastModified) {
      mtime = new Date(_lastModified)
    }

    return {
      mtime,
      maxAge,
      // @ts-ignore
      getData: cachedPromise(() => response.arrayBuffer().then(ab => Buffer.from(ab)))
    }
  }
}
