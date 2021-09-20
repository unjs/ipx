import http from 'http'
import https from 'https'
import { join } from 'path'
import { existsSync, promises as fsp } from 'fs'
import fetch from 'node-fetch'
import { parseURL } from 'ufo'
import { createStorage } from 'unstorage'
import fsDriver from 'unstorage/drivers/fs'
import murmurhash from 'murmurhash'
import type { SourceFactory } from '../types'
import { createError, cachedPromise } from '../utils'

export const createHTTPSource: SourceFactory = (options: any) => {
  const httpsAgent = new https.Agent({ keepAlive: true })
  const httpAgent = new http.Agent({ keepAlive: true })

  let domains = options.domains || []
  if (typeof domains === 'string') {
    domains = domains.split(',').map(s => s.trim())
  }

  if (options.cache && !options.cacheMetadataStore) {
    options.cacheMetadataStore = createStorage({
      driver: fsDriver({ base: join(options.cache, 'metadata') })
    })
  }

  const hosts = domains.map(domain => parseURL(domain, 'https://').host)

  return async (id: string, reqOptions) => {
    // Parse id as URL
    const parsedUrl = parseURL(id, 'https://')

    // Check host
    if (!parsedUrl.host) {
      throw createError('Hostname is missing: ' + id, 403)
    }
    if (!reqOptions?.bypassDomain && !hosts.find(host => parsedUrl.host === host)) {
      throw createError('Forbidden host: ' + parsedUrl.host, 403)
    }
    let response
    if (options.cache) {
      const metadata = await options.cacheMetadataStore.getItem(id)
      if (metadata) {
        const { filename, etag, lastModified } = metadata
        if (existsSync(filename)) {
          const headers = new fetch.Headers()

          if (etag) {
            headers.set('If-None-Match', etag)
          } else {
            headers.set('If-Modified-Since', lastModified)
          }
          response = await fetch(id, {
            agent: id.startsWith('https') ? httpsAgent : httpAgent,
            headers
          })
          if (response.status === 304) {
            return {
              mtime: new Date(lastModified),
              maxAge: options.maxAge || 300,
              getData: cachedPromise(() => fsp.readFile(filename))
            }
          }
        }
      }
    }

    if (!response) {
      response = await fetch(id, {
        agent: id.startsWith('https') ? httpsAgent : httpAgent
      })
    }
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
    const _etag = response.headers.get('etag')

    if (_lastModified) {
      mtime = new Date(_lastModified)
    }

    let buffer

    if (options.cache) {
      const filename = join(options.cache, 'data', `${murmurhash(id)}`)
      await fsp.mkdir(join(options.cache, 'data'), { recursive: true })
      buffer = await response.buffer()
      await fsp.writeFile(filename, buffer)
      await options.cacheMetadataStore.setItem(id, JSON.stringify({ filename, etag: _etag, lastModified: _lastModified }))
    }

    return {
      mtime,
      maxAge,
      getData: cachedPromise(() => buffer || response.buffer())
    }
  }
}
