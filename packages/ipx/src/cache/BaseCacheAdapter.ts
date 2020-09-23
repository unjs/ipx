import IPX from '../ipx'
import { IPXOptions } from '../types'

export default abstract class BaseCacheAdapter {
    ipx: IPX
    options: IPXOptions

    constructor (ipx: IPX) {
      this.ipx = ipx
      this.options = ipx.options

      this.init()
    }

    init (): void {}
    abstract clean(): Promise<void>;
    abstract get (src: string): Promise<Buffer | null>;
    abstract resolve (src: string): string | Promise<string>;
    abstract set (key: string, data: Buffer): Promise<void>
}
