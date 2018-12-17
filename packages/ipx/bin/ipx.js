#!/usr/bin/env node
const connect = require('connect')
const consola = require('consola')

const { IPX, IPXMiddleware } = require(process.env.IPX_DIST || '..')

async function main () {
  const ipx = new IPX()
  const middleware = IPXMiddleware(ipx)
  const app = connect()
  app.use('/', middleware)

  app.listen(3000, () => {
    console.log('Listening on port 3000')
  })
}

main().catch(consola.error)
