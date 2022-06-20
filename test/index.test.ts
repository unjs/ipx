import { listen } from 'listhen'
import { resolve } from 'pathe'
import { describe, it, expect, beforeAll } from 'vitest'
import serveHandler from 'serve-handler'
import { IPX, createIPX } from '../src'

describe('ipx', () => {
  let ipx: IPX
  beforeAll(() => {
    ipx = createIPX({
      dir: resolve(__dirname, 'assets'),
      domains: ['localhost']
    })
  })

  it('remote file', async () => {
    const listener = await listen((req, res) => { serveHandler(req, res, { public: resolve(__dirname, 'assets') }) }, { port: 0 })
    const src = await ipx(`${listener.url}/bliss.jpg`)
    const { data, format } = await src.data()
    expect(data).toBeInstanceOf(Buffer)
    expect(format).toBe('jpeg')
    await listener.close()
  })

  it('local file', async () => {
    const src = await ipx('bliss.jpg')
    const { data, format } = await src.data()
    expect(data).toBeInstanceOf(Buffer)
    expect(format).toBe('jpeg')
  })
})
