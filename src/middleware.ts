import { ServerResponse, IncomingMessage } from 'http'
import getEtag from 'etag'
import IPX from './ipx'
import { badRequest, checkConditionalHeaders } from './utils'

async function IPXReqHandler (req: IncomingMessage, res: ServerResponse, ipx: IPX) {
  // Parse URL
  const url = req.url || '/'
  const urlArgs = url.substr(1).split('/')
  const adapter = decodeURIComponent(urlArgs.shift() || '')
  const format = decodeURIComponent(urlArgs.shift() || '')
  const operations = decodeURIComponent(urlArgs.shift() || '')
  let src = urlArgs.map(c => decodeURIComponent(c)).join('/')

  if (adapter === 'remote' && !src.startsWith('http')) {
    src = (req.headers.referer || req.headers.host || '') + src
  }

  // Validate params
  if (!adapter) {
    throw badRequest('Missing adapter')
  }
  if (!format) {
    throw badRequest('Missing format')
  }
  if (!operations) {
    throw badRequest('Missing operations')
  }
  if (!src) {
    throw badRequest('Missing src')
  }

  // Get basic info about request
  const info = await ipx.getInfo({ adapter, format, operations, src })

  // Set Content-Type header
  res.setHeader('Content-Type', info.mimeType)

  // Set Etag header
  const etag = getEtag(info.cacheKey)
  res.setHeader('Etag', etag)

  if (info.stats) {
    // Set Last-Modified Header
    const lastModified = info.stats.mtime || new Date()
    res.setHeader('Last-Modified', +lastModified)

    // Check conditional headers for 304
    if (checkConditionalHeaders(req, lastModified, etag)) {
      res.statusCode = 304
      return res.end()
    }
  }

  // Process request to get image
  const data = await ipx.getData(info)

  // Send image
  res.end(data)
}

export default function IPXMiddleware (ipx: IPX) {
  return function IPXMiddleware (req: IncomingMessage, res: ServerResponse) {
    IPXReqHandler(req, res, ipx).catch((err) => {
      if (err.statusCode) {
        res.statusCode = err.statusCode
      }
      res.end('IPX Error: ' + err)
    })
  }
}
