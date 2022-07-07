import { ServerResponse, IncomingMessage } from 'http'
import { decode } from 'ufo'
import getEtag from 'etag'
import xss from 'xss'
import { IPX } from './ipx'
import { createError } from './utils'

const MODIFIER_SEP = /[,&]/g
const MODIFIER_VAL_SEP = /[_=:]/g

export interface IPXHRequest {
  url: string
  headers?: Record<string, string>
  options?: any
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
  const [modifiersStr = '', ...idSegments] = req.url.substring(1 /* leading slash */).split('/')
  const id = safeString(decode(idSegments.join('/')))

  // Validate
  if (!modifiersStr) {
    throw createError('Modifiers are missing', 400, req.url)
  }
  if (!id || id === '/') {
    throw createError('Resource id is missing', 400, req.url)
  }

  // Contruct modifiers
  const modifiers: Record<string, string> = Object.create(null)

  // Read modifiers from first segment
  if (modifiersStr !== '_') {
    for (const p of modifiersStr.split(MODIFIER_SEP)) {
      const [key, value = ''] = p.split(MODIFIER_VAL_SEP)
      modifiers[safeString(key)] = safeString(decode(value))
    }
  }

  // Create request
  const img = ipx(id, modifiers, req.options)

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
  if (typeof src.maxAge === 'number') {
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

  return sanetizeReponse(res)
}

export function handleRequest (req: IPXHRequest, ipx: IPX): Promise<IPXHResponse> {
  return _handleRequest(req, ipx).catch((err) => {
    const statusCode = parseInt(err.statusCode) || 500
    const statusMessage = err.statusMessage ? err.statusMessage : `IPX Error (${statusCode})`
    if (process.env.NODE_ENV !== 'production' && statusCode === 500) {
      console.error(err) // eslint-disable-line no-console
    }
    return sanetizeReponse({
      statusCode,
      statusMessage,
      body: 'IPX Error: ' + err,
      headers: {}
    })
  })
}

export function createIPXMiddleware (ipx: IPX) {
  return function IPXMiddleware (req: IncomingMessage, res: ServerResponse) {
    return handleRequest({ url: req.url, headers: req.headers as any }, ipx).then((_res) => {
      res.statusCode = _res.statusCode
      res.statusMessage = _res.statusMessage
      for (const name in _res.headers) {
        res.setHeader(name, _res.headers[name])
      }
      res.end(_res.body)
    })
  }
}

// --- Utils ---

function sanetizeReponse (res: IPXHResponse) {
  return <IPXHResponse>{
    statusCode: res.statusCode || 200,
    statusMessage: res.statusMessage ? safeString(res.statusMessage) : 'OK',
    headers: safeStringObject(res.headers || {}),
    body: typeof res.body === 'string' ? xss(safeString(res.body)) : (res.body || '')
  }
}

function safeString (input: string) {
  return JSON.stringify(input).replace(/^"|"$/g, '')
}

function safeStringObject (input: Record<string, string>) {
  const dst = {}
  for (const key in input) {
    dst[key] = safeString(input[key])
  }
  return dst
}
