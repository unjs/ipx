const { isAbsolute } = require('path').posix
const isValidPath = require('is-valid-path')
const { resolve, relative } = require('path')
const { exists, readFile } = require('fs-extra')

module.exports = class fileAdapter {
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

  async validate (src) {
    if (isAbsolute(src) || !isValidPath(src)) {
      return false
    }

    const _src = this._resolve(src)

    if (relative(this.dir, _src).indexOf('..') !== -1) {
      return false
    }

    if (!await exists(_src)) {
      return false
    }

    return true
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
