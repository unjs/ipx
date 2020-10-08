import https from 'https'
import { stat, Stats } from 'fs-extra'
import fetch from 'node-fetch'
import BaseInputAdapter from './BaseInputAdapter'

export default class RemoteAdapter extends BaseInputAdapter {
  agent?: https.Agent = undefined
  init () {
    this.agent = new https.Agent({
      // keepAliveMsecs: 1000, // default
      // maxSockets: Infinity, // default
      keepAlive: true
    })
  }

  async _retrive (src: string) {
    const cacheKey = src.split(/[?#]/).shift()?.split('//').pop()!
    const cache = await this.ipx.cache?.get(cacheKey)
    if (cache) {
      return {
        cache: await this.ipx.cache?.resolve(cacheKey),
        buffer: cache
      }
    }
    const response = await fetch(src, {
      agent: this.agent
    })
    const buffer = await response.buffer()

    if (this.ipx.cache) {
      this.ipx.cache.set(cacheKey, buffer)
    }

    return {
      cache: await this.ipx.cache?.resolve(cacheKey),
      buffer
    }
  }

  async stats (src: string): Promise<Stats | false> {
    if (!src.startsWith('http')) {
      return false
    }
    const _src = await this._retrive(src)

    try {
      const stats = await stat(_src.cache as string)
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
    return await (await this._retrive(src)).buffer
  }
};
