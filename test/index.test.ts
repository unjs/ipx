import { resolve } from 'pathe'
import { IPX, createIPX } from '../src'

describe('ipx', () => {
  let ipx: IPX
  it('createIPX', () => {
    ipx = createIPX({
      dir: resolve(__dirname, 'assets'),
      domains: ['raw.githubusercontent.com'],
      alias: {
        'gh-raw': 'https://raw.githubusercontent.com'
      }
    })
  })

  it('remote file', async () => {
    const src = await ipx('gh-raw/unjs/ipx/main/test/assets/bliss.jpg')
    const { data, format } = await src.data()
    expect(data).toBeInstanceOf(Buffer)
    expect(format).toBe('jpeg')
  })

  it('local file', async () => {
    const src = await ipx('bliss.jpg')
    const { data, format } = await src.data()
    expect(data).toBeInstanceOf(Buffer)
    expect(format).toBe('jpeg')
  })
})
