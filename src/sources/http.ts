import http from 'http'
import https from 'https'
import fetch from 'node-fetch'
import type { SourceFactory } from '../types'
import { createError, cachedPromise } from '../utils'

export const createHTTPSource: SourceFactory = (options: any) => {
  const httpsAgent = new https.Agent({ keepAlive: true })
  const httpAgent = new http.Agent({ keepAlive: true })

  let domains = options.domains || []
  if (typeof domains === 'string') {
    domains = domains.split(',').map(s => s.trim())
  }

  return async (id: string) => {
    if (!domains.find(base => id.startsWith(base))) {
      throw createError('Forbidden URL:' + id, 403)
    }

    const response = await fetch(id, {
      agent: id.startsWith('https') ? httpsAgent : httpAgent
    })

    if (!response.ok) {
      throw createError(response.statusText || 'fetch error', response.status || 500)
    }

    let maxAge = options.maxAge || 300
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
      getData: cachedPromise(() => response.buffer())
    }
  }
}
