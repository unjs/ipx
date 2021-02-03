import { ServerResponse, IncomingMessage } from 'http'
import { parseURL, normalizeURL, parseQuery, withoutLeadingSlash, decode } from 'ufo'
import getEtag from 'etag'
import xss from 'xss'
import { IPX } from './ipx'

async function handleRequest (req: IncomingMessage, res: ServerResponse, ipx: IPX) {
  const url = parseURL(normalizeURL(req.url))
  const params = parseQuery(url.search)
  const id = withoutLeadingSlash(decode(url.pathname || params.id as string))

  const modifiers: Record<string, string> = Object.create(null)
  for (const pKey in params) {
    if (pKey === 'source' || pKey === 'id') { continue }
    modifiers[pKey] = params[pKey] as string
  }

  // Create request
  const img = ipx(id, {
    modifiers,
    source: params.source as string
  })

  // Get image meta from source
  const meta = await img.meta()

  // Caching headers
  if (meta.mtime) {
    if (req.headers['if-modified-since']) {
      if (new Date(req.headers['if-modified-since']) >= meta.mtime) {
        res.statusCode = 304
        return res.end()
      }
    }
    res.setHeader('Last-Modified', (+meta.mtime))
  }
  if (meta.maxAge !== undefined) {
    res.setHeader('Cache-Control', 'maxAge=' + (+meta.maxAge))
  }

  // Get converted image
  const data = await img.data()

  // Tag
  const etag = getEtag(data)
  res.setHeader('ETag', etag)
  if (etag && req.headers['if-none-match'] === etag) {
    res.statusCode = 304
    return res.end()
  }

  // Send
  res.end(data)
}

export function createIPXMiddleware (ipx: IPX) {
  return function IPXMiddleware (req: IncomingMessage, res: ServerResponse) {
    handleRequest(req, res, ipx).catch((err) => {
      const statusCode = parseInt(err.statusCode) || 500
      const statusMessage = err.statusMessage ? xss(err.statusMessage) : `IPX Error (${statusCode})`
      if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
        console.error(err) // eslint-disable-line no-console
      }
      res.statusCode = statusCode
      res.statusMessage = statusMessage
      return res.end(statusMessage)
    })
  }
}
