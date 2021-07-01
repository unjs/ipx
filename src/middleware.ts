import { ServerResponse, IncomingMessage } from 'http'
import { decode } from 'ufo'
import getEtag from 'etag'
import xss from 'xss'
import { IPX } from './ipx'
import { createError } from './utils'

export interface IPXHRequest {
  url: string
  headers?: Record<string, string>
}

export interface IPXHResponse {
  statusCode: number
  statusMessage: string
  headers: Record<string, string>
  body: any
}

async function _handleRequest (req: IPXHRequest, ipx: IPX): Promise<IPXHResponse> {
  const res: IPXHResponse = {
    statusCode: 200,
    statusMessage: '',
    headers: {},
    body: ''
  }

  // Parse URL
  const [modifiersStr = '', ...idSegments] = req.url.substr(1 /* leading slash */).split('/')
  const id = decode(idSegments.join('/'))

  // Validate
  if (!modifiersStr) {
    throw createError('Modifiers is missing in path: ' + req.url, 400)
  }
  if (!id || id === '/') {
    throw createError('Resource id is missing: ' + req.url, 400)
  }

  // Contruct modifiers
  const modifiers: Record<string, string> = Object.create(null)

  // Read modifiers from first segment
  if (modifiersStr !== '_') {
    for (const p of modifiersStr.split(',')) {
      const [key, value = ''] = p.split('_')
      modifiers[key] = decode(value)
    }
  }

  // Create request
  const img = ipx(id, modifiers)

  // Get image meta from source
  const src = await img.src()

  // Caching headers
  if (src.mtime) {
    if (req.headers['if-modified-since']) {
      if (new Date(req.headers['if-modified-since']) >= src.mtime) {
        res.statusCode = 304
        return res
      }
    }
    res.headers['Last-Modified'] = (+src.mtime) + ''
  }
  if (src.maxAge !== undefined) {
    res.headers['Cache-Control'] = `max-age=${+src.maxAge}, public, s-maxage=${+src.maxAge}`
  }

  // Get converted image
  const { data, format } = await img.data()

  // ETag
  const etag = getEtag(data)
  res.headers.ETag = etag
  if (etag && req.headers['if-none-match'] === etag) {
    res.statusCode = 304
    return res
  }

  // Mime
  if (format) {
    res.headers['Content-Type'] = `image/${format}`
  }

  res.body = data

  return res
}

export function handleRequest (req: IPXHRequest, ipx: IPX): Promise<IPXHResponse> {
  return _handleRequest(req, ipx).catch((err) => {
    const statusCode = parseInt(err.statusCode) || 500
    const statusMessage = err.statusMessage ? xss(err.statusMessage) : `IPX Error (${statusCode})`
    if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
      console.error(err) // eslint-disable-line no-console
    }
    return {
      statusCode,
      statusMessage,
      body: statusMessage,
      headers: {}
    }
  })
}

export function createIPXMiddleware (ipx: IPX) {
  return function IPXMiddleware (req: IncomingMessage, res: ServerResponse) {
    handleRequest({ url: req.url, headers: req.headers as any }, ipx).then((_res) => {
      res.statusCode = _res.statusCode
      res.statusMessage = _res.statusMessage
      for (const name in _res.headers) {
        res.setHeader(name, _res.headers[name])
      }
      res.end(_res.body)
    })
  }
}
