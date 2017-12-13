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

    const img = await ipx.get({ format, operations, src })
    const response = h.response(img.data)

    if (img.cacheKey) {
      response.etag(etag(img.cacheKey).replace(/"/g, ''), { vary: 'Origin' })
    }

    if (img.stats.mtime) {
      response.header('last-modified', img.stats.mtime.toUTCString())
    }

    if (img.format) {
      response.type('image/' + img.format)
    } else {
      response.type('image')
    }

    return response
  }
}
