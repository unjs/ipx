import { resolve, dirname } from 'path'
import recursiveReadDir from 'recursive-readdir'
import { mkdirpSync, mkdirp, exists, readFile, writeFile, stat, remove } from 'fs-extra'
import consola from 'consola'
import shortHash from 'shorthash2'
import BaseCacheAdapter from './BaseCacheAdapter'
export default class FSCache extends BaseCacheAdapter {
  init () {
    // Ensure cacheDir exists
    if (this.options.cache.dir) {
      mkdirpSync(this.options.cache.dir)
    }
  }

  key (src: string) {
    return shortHash(src.split('#').shift()?.split('//').pop())
  }

  resolve (src: string) {
    return resolve(this.options.cache.dir, this.key(src))
  }

  async clean () {
    const now = new Date()
    const diffMins = (t: Date) => ((+now - +t) / (1000 * 60))

    // Scan all files
    const files = await recursiveReadDir(this.options.cache.dir)

    // Stat all files
    let items = await Promise.all(files.map(async (file) => {
      const stats = await stat(file)
      return {
        file,
        lastAccessAgo: diffMins(stats.atime)
      }
    }))

    // Filter items to be invalidated from cache
    const maxUnusedMinutes = +this.options.cache.maxUnusedMinutes
    items = items.filter(item => item.lastAccessAgo >= maxUnusedMinutes)

    await Promise.all(items.map(async (item) => {
      consola.debug('[DELETE] ' + item.file)
      await remove(item.file)
    }))
  }

  async get (src: string) {
    const _path = await this.resolve(src)
    // @ts-ignore
    if (!(await exists(_path))) {
      return null
    }
    consola.debug(`[HIT][${this.key(src)}] ${src}`)
    return readFile(_path)
  }

  async set (src: string, data: Buffer) {
    const _path = await this.resolve(src)
    await mkdirp(dirname(_path))
    return writeFile(_path, data)
  }
}
