const { isAbsolute } = require('path').posix
const isValidPath = require('is-valid-path')
const { resolve, relative } = require('path')
const { readFile, stat } = require('fs-extra')

module.exports = class FSAdapter {
  constructor (sharp) {
    this.sharp = sharp
    this.options = sharp.options
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
}
