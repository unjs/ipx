import Config from 'config'
import getEtag from 'etag'
import IPX from './ipx'
import { badRequest, checkConditionalHeaders } from './utils'

const ipx = new IPX(Config.get('ipx'))

async function ipxReqHandler (req, res, next) {
  // Parse URL
  const urlArgs = decodeURIComponent(req.url.substr(1)).split('/')
  const format = urlArgs.shift()
  const operations = urlArgs.shift()
  const src = urlArgs.join('/')

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

export default function ipxMiddleware (req, res, next) {
  ipxReqHandler(req, res, next).catch(err => {
    res.end('IPX Error: ' + err)
  })
};
