import { Stats } from 'fs-extra'
import IPX from '../ipx'
import { IPXOptions } from '../types'

export default abstract class BaseInputAdapter {
    ipx: IPX
    options: IPXOptions

    constructor (ipx: IPX) {
      this.ipx = ipx
      this.options = ipx.options

      this.init()
    }

    init (): void {}
    abstract test(src: string): Boolean;
    abstract get (src: string): Promise<Buffer>;
    abstract stats (src: string): Promise<Stats | false>;
}
