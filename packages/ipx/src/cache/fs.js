import { resolve, dirname } from 'path'
import recursiveReadDir from 'recursive-readdir'
import { mkdirpSync, mkdirp, exists, readFile, writeFile, stat, remove } from 'fs-extra'
import consola from 'consola'

export default class FSCache {
  constructor (ipx) {
    this.ipx = ipx
    this.options = ipx.options

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
      consola.debug('[DELETE] ' + item.file)
      await remove(item.file)
    }))
  }

  async get (key) {
    const _path = this.resolve(key)
    if (!(await exists(_path))) {
      return null
    }
    consola.debug('[HIT] ' + key)
    return readFile(_path)
  }

  async set (key, data) {
    const _path = this.resolve(key)
    await mkdirp(dirname(_path))
    return writeFile(_path, data)
  }
}
