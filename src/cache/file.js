const { resolve, dirname } = require('path')
const recursiveReadDir = require('recursive-readdir')
const { mkdirpSync, mkdirp, exists, readFile, writeFile, stat, remove } = require('fs-extra')

module.exports = class FileCache {
  constructor (shark) {
    this.shark = shark
    this.options = shark.options

    this.init()
  }

  init () {
    // Ensure cacheDir exists
    if (this.options.cache.dir) {
      mkdirpSync(this.options.cache.dir)
    }
  }

  resolve (key) {
    return resolve(this.options.cache.dir, key)
  }

  async clean () {
    const now = new Date()
    const diffMins = t => ((now - t) / (1000 * 60))

    // Scan all files
    const files = await recursiveReadDir(this.options.cache.dir)

    // Stat all files
    let items = await Promise.all(files.map(async file => {
      const stats = await stat(file)
      return {
        file,
        lastAccessAgo: diffMins(stats.atime)
      }
    }))

    // Filter items to be invalidated from cache
    const maxUnusedMinutes = parseInt(this.options.cache.maxUnusedMinutes)
    items = items.filter(item => item.lastAccessAgo >= maxUnusedMinutes)

    await Promise.all(items.map(async item => {
      console.log('[D] ' + item.file)
      await remove(item.file)
    }))
  }

  async get (key) {
    const _path = this.resolve(key)
    if (!(await exists(_path))) {
      return null
    }
    return readFile(_path)
  }

  async set (key, data) {
    const _path = this.resolve(key)
    await mkdirp(dirname(_path))
    return writeFile(_path, data)
  }
}
