import connect from 'connect'
import consola from 'consola'

import { IPX, IPXMiddleware } from './index'

function main () {
  // Create IPX instance
  const ipx = new IPX({})

  // Create a HTTP server
  const app = connect()

  // Create and use middleware
  const middleware = IPXMiddleware(ipx)
  app.use('/', middleware)

  // Start listening
  const literner = app.listen(ipx.options.port, () => {
    const { port } = literner.address() as any
    consola.info(`Listening on port ${port}`)
  })
}

main()
