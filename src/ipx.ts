import { resolve, extname } from 'path'
import Sharp from 'sharp'
import defu from 'defu'
import { CronJob } from 'cron'
import { Stats } from 'fs-extra'
import { IPXImage, IPXImageInfo, IPXInputOption, IPXOperations, IPXOptions, IPXParsedOperation, IPXAdapterOptions } from 'types'
import OPERATIONS from './operations'
import { badRequest, notFound, consola } from './utils'
import getConfig from './config'
import * as InputAdapters from './input'
import * as CacheAdapters from './cache'
import BaseInputAdapter from './input/BaseInputAdapter'
import BaseCacheAdapter from './cache/BaseCacheAdapter'

const operationSeparator = ','
const argSeparator = '_'

class IPX {
  options: IPXOptions
  operations: IPXOperations
  adapter: any
  inputs: BaseInputAdapter[] = []
  cache: BaseCacheAdapter | undefined

  private cacheCleanCron: CronJob | undefined

  constructor (options: IPXOptions) {
    this.options = defu(options, getConfig())
    this.operations = {}
    this.adapter = null

    this.init()
  }

  init () {
    // Merge and normalize operations
    const _operations = Object.assign({}, OPERATIONS, this.options.operations)
    Object.keys(_operations)
      .filter(_key => _operations[_key])
      .forEach((_key) => {
        const operation = _operations[_key]
        const key = _key || operation.key!

        this.operations[key] = {
          name: operation.name || key,
          handler: (operation.handler || operation) as any /* TODO */,
          multiply: Boolean(operation.multiply),
          order: Boolean(operation.order),
          args: operation.args || []
        }
      })

    const inputs: any[] = this.options.inputs
    this.initInputs(inputs)

    // Create instance of cache
    let CacheCtor: { new(ipx: IPX): BaseCacheAdapter }
    if (typeof this.options.cache.adapter === 'string') {
      const adapter = this.options.cache.adapter
      CacheCtor = (CacheAdapters as any)[adapter] || require(resolve(adapter))
    } else {
      CacheCtor = this.options.cache.adapter
    }
    this.cache = new CacheCtor(this)
    if (typeof this.cache.init === 'function') {
      this.cache.init()
    }

    // Start cache cleaning cron
    if (this.options.cache.cleanCron) {
      this.cacheCleanCron = new CronJob(
        this.options.cache.cleanCron,
        () => this.cleanCache().catch(consola.error)
      )
      consola.info('Starting cache clean cron ' + this.options.cache.cleanCron)
      this.cacheCleanCron.start()
    }
  }

  /**
   * Parse operations
   * @param {String} operations
   */
  parseOperations (operations: string): IPXParsedOperation[] {
    const ops: { [key: string]: true } = {}

    if (operations === '_') {
      return []
    }

    return operations.split(operationSeparator).map((_o) => {
      const [key, ...args] = _o.split(argSeparator)

      const operation = this.operations[key]
      if (!operation) {
        throw badRequest('Invalid operation: ' + key)
      }
      /**
       * allow optional arguments for operations
       */
      if (operation.args.length > args.length) {
        throw badRequest('Invalid number of args for ' + key + '. Expected ' + operation.args.length + ' got ' + args.length)
      }

      for (let i = 0; i < operation.args.length; i++) {
        args[i] = operation.args[i](args[i])
      }

      if (!operation.multiply) {
        if (ops[operation.name]) {
          throw badRequest(key + ' can be only used once')
        }
        ops[operation.name] = true
      }

      return {
        operation,
        args,
        cacheKey: key + argSeparator + args.join(argSeparator)
      }
    })
  }

  async getInfo ({ adapter, format, operations, src }: IPXImage): Promise<IPXImageInfo> {
    // Validate format
    if (format === '_') {
      format = extname(src).substr(1)
    }

    if (format === 'jpg') {
      format = 'jpeg'
    }

    if (!['jpeg', 'webp', 'png'].includes(format)) {
      throw badRequest(`Unkown image format ${format}`)
    }

    // Validate src
    if (!src || src.includes('..')) {
      throw notFound()
    }

    // Get src stat
    const stats = await this.stats(src, adapter)
    if (!stats) {
      throw notFound()
    }

    // Parse and validate operations
    let _operations = this.parseOperations(operations)

    // Reorder operations
    _operations = [
      ..._operations.filter(o => o.operation.order !== true).sort(),
      ..._operations.filter(o => o.operation.order === true)
    ]

    // Compute unique hash key
    const operationsKey = _operations.length ? _operations.map(o => o.cacheKey).join(argSeparator) : '_'
    const statsKey = stats.mtime.getTime().toString(16) + '-' + stats.size.toString(16)
    const cacheKey = src + '/' + statsKey + '/' + operationsKey + '.' + format

    // Return info
    return {
      operations: _operations,
      stats,
      cacheKey,
      adapter,
      format,
      src
    }
  }

  async applyOperations ({ adapter, operations, format, src }: IPXImageInfo): Promise<Sharp.Sharp> {
    // Read buffer from input
    const srcBuff = await this.get(src, adapter)

    // Process using Sharp
    let sharp = Sharp(srcBuff)

    if (format !== '_') {
      operations.push({
        operation: this.operations.format,
        args: [format]
      })
    }

    // shared context for operations batch
    const context = {}
    operations.forEach(({ operation, args }) => {
      sharp = operation.handler(context, sharp, ...args) || sharp
    })
    return sharp
  }

  async getData (info: IPXImageInfo) {
    // Check cache existence
    const cache = await this.cache!.get(info.cacheKey)
    if (cache) {
      return cache
    }
    const sharp = await this.applyOperations(info)
    const data = await sharp.toBuffer()

    // Put data into cache
    try {
      await this.cache!.set(info.cacheKey, data)
    } catch (e) {
      consola.error(e)
    }

    return data
  }

  async getJSONData (info: IPXImageInfo) {
    const cacheKey = info.cacheKey + '.json'
    // Check cache existence
    const cache = await this.cache!.get(cacheKey)
    if (cache) {
      return cache
    }
    const sharp = await this.applyOperations(info)
    const metadata = await sharp.metadata()
    const buffer = await sharp.toBuffer()
    const data = Buffer.from(JSON.stringify({
      data: `data:image/${info.format};base64,${buffer.toString('base64')}`,
      width: metadata.width,
      height: metadata.height
    }))

    // Put data into cache
    try {
      await this.cache!.set(cacheKey, data)
    } catch (e) {
      consola.error(e)
    }

    return data
  }

  async cleanCache () {
    if (this.cache) {
      await this.cache.clean()
    }
  }

  private initInputs (inputs: any) {
    this.inputs = inputs.map(({ adapter, ...options }: IPXInputOption): BaseInputAdapter => {
      // Create instance of input
      let InputCtor: { new(ipx: IPX, options: IPXAdapterOptions): BaseInputAdapter }
      if (typeof adapter === 'string') {
        InputCtor = (InputAdapters as any)[adapter] || require(resolve(adapter))
      } else {
        InputCtor = adapter
      }
      const input = new InputCtor(this, options)
      if (typeof input.init === 'function') {
        input.init()
      }
      return input
    })
  }

  private async stats (src: string, adapter: string): Promise<Stats | false> {
    const input = this.inputs.find(inp => inp.name === adapter)

    if (input) {
      return await input.stats(src)
    }
    return false
  }

  private async get (src: string, adapter: string) {
    const input = this.inputs.find(inp => inp.name === adapter)

    return await input!.get(src)
  }
}

export default IPX
