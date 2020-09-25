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
    abstract get (src: string): Promise<Buffer>;
    abstract _resolve (src: string): string | Promise<string>;
    abstract stats (src: string): Promise<Stats | false>;
}
