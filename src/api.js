const Boom = require('boom')
const Config = require('config')
const IPX = require('./ipx')

const ipx = new IPX(Config.get('ipx'))

module.exports = {
  method: 'GET',
  path: '{format}/{operations}/{src*}',
  async handler ({ params = {} }, h) {
    const { format, operations, src } = params

    if (!src || !operations || !format) {
      throw Boom.badRequest('Invalid URL')
    }

    const img = await ipx.get({ format, operations, src })
    const response = h.response(img.data)

    if (img.format) {
      response.type('image/' + img.format)
    } else {
      response.type('image')
    }

    return response
  }
}
