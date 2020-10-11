const connect = require('connect')
const consola = require('consola')

const { IPX, IPXMiddleware } = require(process.env.IPX_DIST || '..')

function main () {
  // Create IPX instance
  const ipx = new IPX()

  // Create a HTTP server
  const app = connect()

  // Create and use middleware
  const middleware = IPXMiddleware(ipx)
  app.use('/', middleware)

  // Start listening
  const literner = app.listen(ipx.options.port, () => {
    const { port } = literner.address()
    consola.info(`Listening on port ${port}`)
  })
}

main()
