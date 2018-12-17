import Consola from 'consola'

const MAX_SIZE = 2048

const argRegex = /^[a-z0-9]+$/i
const numRegex = /^[1-9][0-9]*$/

export function checkConditionalHeaders (req, lastModified, etag) {
  // If-None-Match header
  const ifNoneMatch = req.headers['if-none-match']
  if (ifNoneMatch === etag) {
    return true
  }

  // If-Modified-Since header
  const ifModifiedSince = req.headers['if-modified-since']
  if (ifModifiedSince) {
    if (new Date(ifModifiedSince) >= lastModified) {
      return true
    }
  }

  return false
}

export function badRequest (msg) {
  const err = new Error('Bad Request: ' + msg)
  err.statusCode = 400
  return err
}

export function notFound () {
  const err = new Error('Not Found')
  err.statusCode = 404
  return err
}

export const VArg = arg => {
  if (!argRegex.test(arg)) {
    throw badRequest('Invalid argument: ' + arg)
  }
  return arg
}

export const VMax = max => num => {
  if (!numRegex.test(num)) {
    throw badRequest('Invalid numeric argument: ' + num)
  }
  return Math.min(parseInt(num), max) || null
}

export const VSize = VMax(MAX_SIZE)

export const consola = Consola.withTag('ipx')
