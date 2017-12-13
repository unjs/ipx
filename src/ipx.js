const OPERATIONS = require('./operations')
const { resolve, extname } = require('path')
const Boom = require('boom')
const Sharp = require('sharp')
const { CronJob } = require('cron')
const debug = require('debug')('ipx')

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
        throw Boom.badRequest('Invalid operation: ' + key)
      }

      if (operation.args.length !== args.length) {
        throw Boom.badRequest('Invalid number of args for ' + key + '. Expected ' + operation.args.length + ' got ' + args.length)
      }

      for (let i = 0; i < operation.args.length; i++) {
        args[i] = operation.args[i](args[i])
      }

      if (!operation.multiply) {
        if (ops[operation.name]) {
          throw Boom.badRequest(key + ' can be only used once')
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

  /**
   * Convert and get the result
   * @param {String} format
   * @param {String} operations
   * @param {String} src
   */
  async get ({ format, operations, src }) {
    // Validate format
    if (format === '_') {
      format = extname(src).substr(1)
    }

    if (format === 'jpg') {
      format = 'jpeg'
    }

    if (['jpeg', 'webp', 'png'].indexOf(format) === -1) {
      throw Boom.badRequest('Invalid format ' + format)
    }

    // Validate src
    if (!src || src.indexOf('..') >= 0) {
      throw Boom.notFound()
    }

    // Get src stat
    const stats = await this.input.stats(src)
    if (!stats) {
      throw Boom.notFound()
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

    // Check cache existence
    const cache = await this.cache.get(cacheKey)
    if (cache) {
      return {
        format,
        data: cache,
        stats,
        cacheKey
      }
    }

    // Read buffer from input
    const srcBuff = await this.input.get(src)

    // Process using Sharp
    let sharp = new Sharp(srcBuff)

    if (format !== '_') {
      sharp = sharp.toFormat(format)
    }

    _operations.forEach(({ operation, args }) => {
      try {
        sharp = operation.handler(this, sharp, ...args)
      } catch (e) {
        if (Boom.isBoom(e)) {
          throw e
        }
        console.error(e + '')
        throw Boom.internal()
      }
    })
    const data = await sharp.toBuffer()

    // Put data into cache
    try {
      await this.cache.set(cacheKey, data)
    } catch (e) {
      console.error(e)
    }

    return {
      data,
      format,
      stats,
      cacheKey
    }
  }

  async cleanCache () {
    if (this.cache) {
      await this.cache.clean()
    }
  }
}

module.exports = IPX
