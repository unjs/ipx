const Boom = require('boom')
const Config = require('config')
const IPX = require('./ipx')
const etag = require('etag')

const ipx = new IPX(Config.get('ipx'))

module.exports = {
  method: 'GET',
  path: '{format}/{operations}/{src*}',
  options: {
    // https://hapijs.com/api#-routeoptionscache
    cache: false
  },
  async handler ({ params = {} }, h) {
    const { format, operations, src } = params

    if (!src || !operations || !format) {
      throw Boom.badRequest('Invalid URL')
    }

    // Get basic info about request
    const info = await ipx.getInfo({ format, operations, src })

    // Sets the response 'ETag' and 'Last-Modified' headers and
    // checks for any conditional request headers to decide
    // if the response is going to qualify for an HTTP 304 (Not Modified)
    // https://hapijs.com/api#-hentityoptions
    let response = h.entity({
      etag: etag(info.cacheKey).replace(/"/g, ''),
      modified: info.stats.mtime
    })

    // Get real response
    if (!response) {
      const data = await ipx.getData(info)
      response = h.response(data)
    }

    // Set additional headers
    if (info.format) {
      response.type('image/' + info.format)
    } else {
      response.type('image')
    }

    return response
  }
}
