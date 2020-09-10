import OPERATIONS from './operations'
import { resolve, extname } from 'path'
import Sharp from 'sharp'
import defu from 'defu'
import { CronJob } from 'cron'
import { badRequest, notFound, consola } from './utils'
import getConfig from './config'
import * as InputAdapters from './input'
import * as CacheAdapters from './cache'
import { IPXImage, IPXImageInfo, IPXOperations, IPXOptions, IPXParsedOperation } from './types'
import { Stats } from 'fs-extra'
import BaseInputAdapter from './input/BaseInputAdapter'
import BaseCacheAdapter from './cache/BaseCacheAdapter'

const operationSeparator = ','
const argSeparator = '_'

class IPX {
  options: IPXOptions
  operations: IPXOperations
  adapter: any
  input: BaseInputAdapter | undefined
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
      .forEach(_key => {
        const operation = _operations[_key]
        const key = _key || operation.key!
        
        this.operations[key] = {
          name: operation.name || key,
          handler: operation.handler || operation,
          multiply: Boolean(operation.multiply),
          order: Boolean(operation.order),
          args: operation.args || []
        }
      })

    // Create instance of input
    let InputCtor: { new(ipx: IPX): BaseInputAdapter }
    if (typeof this.options.input.adapter === 'string') {
      const adapter = this.options.input.adapter

      InputCtor = (InputAdapters as any)[adapter] || require(resolve(adapter))
    } else {
      InputCtor = this.options.input.adapter
    }
    this.input = new InputCtor(this)
    if (typeof this.input.init === 'function') {
      this.input.init()
    }

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

    return operations.split(operationSeparator).map(_o => {
      let [key, ...args] = _o.split(argSeparator)

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

  async getInfo ({ format, operations, src }: IPXImage): Promise<IPXImageInfo> {
    // Validate format
    if (format === '_') {
      format = extname(src).substr(1)
    }

    if (format === 'jpg') {
      format = 'jpeg'
    }

    if (['jpeg', 'webp', 'png'].indexOf(format) === -1) {
      throw badRequest(`Unkown image format ${format}`)
    }

    // Validate src
    if (!src || src.indexOf('..') >= 0) {
      throw notFound()
    }

    // Get src stat
    const stats = await this.input!.stats(src)
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
      format,
      src
    }
  }

  async getData ({ cacheKey, stats, operations, format, src }: IPXImageInfo) {
    // Check cache existence
    const cache = await this.cache!.get(cacheKey)
    if (cache) {
      return cache
    }

    // Read buffer from input
    const srcBuff = await this.input!.get(src)

    // Process using Sharp
    let sharp = Sharp(srcBuff)

    if (format !== '_') {
      sharp = sharp.toFormat(format)
    }

    operations.forEach(({ operation, args }) => {
      sharp = operation.handler(this, sharp, ...args)
    })
    const data = await sharp.toBuffer()

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
}

export default IPX
