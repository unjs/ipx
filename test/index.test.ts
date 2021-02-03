import { resolve } from 'path'
import { IPX, createIPX } from '../src'

describe('ipx', () => {
  let ipx: IPX
  it('createIPX', () => {
    ipx = createIPX({
      local: {
        dir: resolve(__dirname, 'assets')
      }
    })
  })

  it('src.getData', async () => {
    const src = await ipx({
      id: 'bliss.jpg',
      source: 'local'
    })
    const data = await src.getData()
    expect(data).toBeInstanceOf(Buffer)
  })
})
