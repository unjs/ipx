import { resolve, posix, relative } from 'path'
import isValidPath from 'is-valid-path'
import { readFile, stat, Stats } from 'fs-extra'
import BaseInputAdapter from './BaseInputAdapter'

export default class FSAdapter extends BaseInputAdapter {
  get dir () {
    return this.options.input.dir
  }

  _resolve (src: string) {
    return resolve(this.dir, src)
  }

  async stats (src: string): Promise<Stats | false> {
    if (posix.isAbsolute(src) || !isValidPath(src)) {
      return false
    }

    const _src = await this._resolve(src)

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
  async get (src: string) {
    const _src = await this._resolve(src)
    const buff = readFile(_src)
    return buff
  }
};
