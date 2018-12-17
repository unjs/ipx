import isValidPath from 'is-valid-path'
import { resolve, relative } from 'path'
import { readFile, stat } from 'fs-extra'
const { isAbsolute } = require('path').posix

export default class FSAdapter {
  constructor (ipx) {
    this.options = ipx.options
  }

  get dir () {
    return this.options.input.dir
  }

  _resolve (src) {
    return resolve(this.dir, src)
  }

  async stats (src) {
    if (isAbsolute(src) || !isValidPath(src)) {
      return false
    }

    const _src = this._resolve(src)

    if (relative(this.dir, _src).includes('..')) {
      return false
    }

    try {
      const stats = await stat(_src)
      return stats
    } catch (e) {
      // TODO: check for permission errors
      return false
    }
  }

  /**
   * @param {String} src
   * @returns Promise<Buffer>
   */
  get (src) {
    const _src = this._resolve(src)
    const buff = readFile(_src)
    return buff
  }
};
