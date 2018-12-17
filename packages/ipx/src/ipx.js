const OPERATIONS = require('./operations')
const { resolve, extname } = require('path')
const Sharp = require('sharp')
const { CronJob } = require('cron')

const debug = require('debug')('ipx')

const { badRequest, notFound } = require('./utils')

const operationSeparator = ','
const argSeparator = '_'

class IPX {
  constructor (options) {
    this.options = options
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
        const key = _key || operation.key
        this.operations[key] = {
          name: operation.name || key,
          handler: operation.handler || operation,
          multiply: Boolean(operation.multiply),
          order: Boolean(operation.order),
          args: operation.args || []
        }
      })

    // Create instance of input
    let InputCtor = this.options.input.adapter
    if (typeof InputCtor === 'string') {
      InputCtor = require(resolve(__dirname, 'input', InputCtor))
    }
    this.input = new InputCtor(this)

    // Create instance of cache
    let CacheCtor = this.options.cache.adapter
    if (typeof CacheCtor === 'string') {
      CacheCtor = require(resolve(__dirname, 'cache', CacheCtor))
    }
    this.cache = new CacheCtor(this)

    // Start cache cleaning cron
    if (this.options.cache.cleanCron) {
      this.cacheCleanCron = new CronJob(
        this.options.cache.cleanCron,
        () => this.cleanCache().catch(console.error)
      )
      debug('Starting cache clean cron ' + this.options.cache.cleanCron)
      this.cacheCleanCron.start()
    }
  }

  /**
   * Parse operations
   * @param {String} operations
   */
  parseOperations (operations) {
    const ops = {}

    if (operations === '_') {
      return []
    }

    return operations.split(operationSeparator).map(_o => {
      let [key, ...args] = _o.split(argSeparator)

      const operation = this.operations[key]
      if (!operation) {
        throw badRequest('Invalid operation: ' + key)
      }

      if (operation.args.length !== args.length) {
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

  async getInfo ({ format, operations, src }) {
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
    const stats = await this.input.stats(src)
    if (!stats) {
      throw notFound()
    }

    // Parse and validate operations
    let _operations = this.parseOperations(operations)

    // Reorder operations
    _operations = [].concat(
      _operations.filter(o => o.operation.order !== true).sort(),
      _operations.filter(o => o.operation.order === true)
    )

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

  async getData ({ cacheKey, stats, operations, format, src }) {
    // Check cache existence
    const cache = await this.cache.get(cacheKey)
    if (cache) {
      return cache
    }

    // Read buffer from input
    const srcBuff = await this.input.get(src)

    // Process using Sharp
    let sharp = new Sharp(srcBuff)

    if (format !== '_') {
      sharp = sharp.toFormat(format)
    }

    operations.forEach(({ operation, args }) => {
      sharp = operation.handler(this, sharp, ...args)
    })
    const data = await sharp.toBuffer()

    // Put data into cache
    try {
      await this.cache.set(cacheKey, data)
    } catch (e) {
      console.error(e)
    }

    return data
  }

  async cleanCache () {
    if (this.cache) {
      await this.cache.clean()
    }
  }
}

module.exports = IPX
