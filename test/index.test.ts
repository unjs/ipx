import { resolve } from 'pathe'
import { IPX, createIPX } from '../src'

describe('ipx', () => {
  let ipx: IPX
  it('createIPX', () => {
    ipx = createIPX({
      dir: resolve(__dirname, 'assets')
    })
  })

  it('data', async () => {
    const src = await ipx('bliss.jpg')
    const { data, format } = await src.data()
    expect(data).toBeInstanceOf(Buffer)
    expect(format).toBe('jpeg')
  })
})
