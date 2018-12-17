const MAX_SIZE = 2048

const argRegex = /^[a-z0-9]+$/i
const numRegex = /^[1-9][0-9]*$/

function checkConditionalHeaders (req, lastModified, etag) {
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

function badRequest (msg) {
  const err = new Error('Bad Request: ' + msg)
  err.code = 400
  return err
}

function notFound () {
  const err = new Error('Not Found')
  err.code = 404
  return err
}

const VArg = arg => {
  if (!argRegex.test(arg)) {
    throw badRequest('Invalid argument: ' + arg)
  }
  return arg
}

const VMax = max => num => {
  if (!numRegex.test(num)) {
    throw badRequest('Invalid numeric argument: ' + num)
  }
  return Math.min(parseInt(num), max) || null
}

const VSize = VMax(MAX_SIZE)

module.exports = {
  badRequest,
  notFound,
  checkConditionalHeaders,
  VArg,
  VMax,
  VSize
}
