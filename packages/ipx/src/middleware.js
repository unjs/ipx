import getEtag from 'etag'
import { badRequest, checkConditionalHeaders } from './utils'

async function IPXReqHandler (req, res, ipx) {
  // Parse URL
  const urlArgs = req.url.substr(1).split('/')
  const format = decodeURIComponent(urlArgs.shift())
  const operations = decodeURIComponent(urlArgs.shift())
  const src = urlArgs.map(c => decodeURIComponent(c)).join('/')

  // Validate params
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
  const info = await ipx.getInfo({ format, operations, src })

  // Set Content-Type header
  if (info.format) {
    res.setHeader('Content-Type', 'image/' + info.format)
  } else {
    res.setHeader('Content-Type', 'image')
  }

  // Set Last-Modified Header
  const lastModified = info.stats.mtime || new Date()
  res.setHeader('Last-Modified', lastModified)

  // Set Etag header
  const etag = getEtag(info.cacheKey)
  res.setHeader('Etag', etag)

  // Check conditional headers for 304
  if (checkConditionalHeaders(req, lastModified, etag)) {
    res.statusCode = 304
    return res.end()
  }

  // Process request to get image
  const data = await ipx.getData(info)

  // Send image
  res.end(data)
}

export default function IPXMiddleware (ipx) {
  return function IPXMiddleware (req, res) {
    IPXReqHandler(req, res, ipx).catch(err => {
      if (err.statusCode) {
        res.statusCode = err.statusCode
      }
      res.end('IPX Error: ' + err)
    })
  }
}
